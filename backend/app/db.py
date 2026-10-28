import abc
from typing import Dict, Any, List, Optional
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extras import RealDictCursor
from .config import settings


class QueryResult:
    """Encapsulates the standard query result data."""
    def __init__(self, data: List[Dict[str, Any]]):
        self.data = data


class DatabaseInterface(abc.ABC):
    """
    Interface Segregation Principle & Dependency Inversion:
    Abstracts persistence details so services depend on interfaces, not implementations.
    """
    @abc.abstractmethod
    def select(self, table: str, cols: str = "*", filters: Optional[Dict[str, Any]] = None,
               order_by: Optional[str] = None, desc: bool = False, limit: Optional[int] = None) -> QueryResult:
        pass

    @abc.abstractmethod
    def insert(self, table: str, record: Dict[str, Any]) -> QueryResult:
        pass

    @abc.abstractmethod
    def upsert(self, table: str, record: Dict[str, Any], conflict_target: str, update_cols: Optional[List[str]] = None) -> QueryResult:
        pass

    @abc.abstractmethod
    def delete(self, table: str, filters: Dict[str, Any]) -> QueryResult:
        pass


class PostgresDatabase(DatabaseInterface):
    """
    High-performance pooled PostgreSQL client implementation.
    Follows Single Responsibility Principle (SRP) for database operations.
    """
    def __init__(self, connection_url: str, min_conn: int = 1, max_conn: int = 15):
        self._pool = ThreadedConnectionPool(min_conn, max_conn, connection_url)

    def _get_conn(self):
        conn = self._pool.getconn()
        try:
            if getattr(conn, "closed", 0):
                self._pool.putconn(conn, close=True)
                conn = self._pool.getconn()
        except Exception:
            pass
        return conn

    def _put_conn(self, conn, failed: bool = False):
        try:
            if failed or getattr(conn, "closed", 0):
                self._pool.putconn(conn, close=True)
            else:
                self._pool.putconn(conn)
        except Exception:
            pass

    def select(self, table: str, cols: str = "*", filters: Optional[Dict[str, Any]] = None,
               order_by: Optional[str] = None, desc: bool = False, limit: Optional[int] = None) -> QueryResult:
        for attempt in range(2):
            conn = self._get_conn()
            failed = False
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    where_clauses = []
                    params = []
                    if filters:
                        for col, val in filters.items():
                            where_clauses.append(f'"{col}" = %s')
                            params.append(val)
                    where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

                    # Support for JSON joins if requested in legacy queries
                    if table == "case_enrollments" and "cases(*)" in cols:
                        sql = f"""
                            SELECT row_to_json(c.*) as "cases"
                            FROM case_enrollments ce
                            JOIN cases c ON c.id = ce.case_id
                        """
                        ce_clauses = [f'ce."{col}" = %s' for col in (filters or {})]
                        ce_where = (" WHERE " + " AND ".join(ce_clauses)) if ce_clauses else ""
                        sql += ce_where
                        cur.execute(sql, params)
                        return QueryResult(data=[dict(r) for r in cur.fetchall()])

                    if table == "case_enrollments" and "users(" in cols:
                        ce_clauses = [f'ce."{col}" = %s' for col in (filters or {})]
                        ce_where = (" WHERE " + " AND ".join(ce_clauses)) if ce_clauses else ""
                        sql = f"""
                            SELECT json_build_object('id', u.id, 'email', u.email, 'full_name', u.full_name) as "users"
                            FROM case_enrollments ce
                            JOIN users u ON u.id = ce.user_id
                            {ce_where}
                        """
                        cur.execute(sql, params)
                        return QueryResult(data=[dict(r) for r in cur.fetchall()])

                    column_sql = cols
                    if cols != "*":
                        column_sql = ", ".join(f'"{c.strip()}"' for c in cols.split(","))

                    sql = f'SELECT {column_sql} FROM "{table}"{where_sql}'
                    if order_by:
                        sql += f' ORDER BY "{order_by}" {"DESC" if desc else "ASC"}'
                    if limit:
                        sql += f' LIMIT {limit}'

                    cur.execute(sql, params)
                    return QueryResult(data=[dict(r) for r in cur.fetchall()])
            except psycopg2.OperationalError:
                failed = True
                if attempt == 0:
                    continue
                raise
            except Exception:
                failed = True
                raise
            finally:
                self._put_conn(conn, failed=failed)

    def insert(self, table: str, record: Dict[str, Any]) -> QueryResult:
        for attempt in range(2):
            conn = self._get_conn()
            failed = False
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    keys = list(record.keys())
                    cols = ", ".join(f'"{k}"' for k in keys)
                    placeholders = ", ".join(["%s"] * len(keys))
                    vals = [record[k] for k in keys]
                    sql = f'INSERT INTO "{table}" ({cols}) VALUES ({placeholders}) RETURNING *;'
                    cur.execute(sql, vals)
                    conn.commit()
                    return QueryResult(data=[dict(r) for r in cur.fetchall()])
            except psycopg2.OperationalError:
                failed = True
                try:
                    conn.rollback()
                except Exception:
                    pass
                if attempt == 0:
                    continue
                raise
            except Exception:
                failed = True
                try:
                    conn.rollback()
                except Exception:
                    pass
                raise
            finally:
                self._put_conn(conn, failed=failed)

    def upsert(self, table: str, record: Dict[str, Any], conflict_target: str, update_cols: Optional[List[str]] = None) -> QueryResult:
        for attempt in range(2):
            conn = self._get_conn()
            failed = False
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    keys = list(record.keys())
                    cols = ", ".join(f'"{k}"' for k in keys)
                    placeholders = ", ".join(["%s"] * len(keys))
                    vals = [record[k] for k in keys]

                    if update_cols:
                        set_clause = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in update_cols)
                        action = f"DO UPDATE SET {set_clause}"
                    else:
                        action = "DO NOTHING"

                    sql = f'INSERT INTO "{table}" ({cols}) VALUES ({placeholders}) ON CONFLICT {conflict_target} {action} RETURNING *;'
                    cur.execute(sql, vals)
                    conn.commit()
                    rows = cur.fetchall() if cur.description else []
                    return QueryResult(data=[dict(r) for r in rows])
            except psycopg2.OperationalError:
                failed = True
                try:
                    conn.rollback()
                except Exception:
                    pass
                if attempt == 0:
                    continue
                raise
            except Exception:
                failed = True
                try:
                    conn.rollback()
                except Exception:
                    pass
                raise
            finally:
                self._put_conn(conn, failed=failed)

    def delete(self, table: str, filters: Dict[str, Any]) -> QueryResult:
        for attempt in range(2):
            conn = self._get_conn()
            failed = False
            try:
                with conn.cursor() as cur:
                    where_clauses = [f'"{col}" = %s' for col in filters.keys()]
                    where_sql = " WHERE " + " AND ".join(where_clauses)
                    sql = f'DELETE FROM "{table}"{where_sql};'
                    cur.execute(sql, list(filters.values()))
                    conn.commit()
                    return QueryResult(data=[])
            except psycopg2.OperationalError:
                failed = True
                try:
                    conn.rollback()
                except Exception:
                    pass
                if attempt == 0:
                    continue
                raise
            except Exception:
                failed = True
                try:
                    conn.rollback()
                except Exception:
                    pass
                raise
            finally:
                self._put_conn(conn, failed=failed)


class TableQueryBuilder:
    """Fluent query builder providing backwards compatibility with Supabase query syntax."""
    def __init__(self, table_name: str, db: DatabaseInterface):
        self.table_name = table_name
        self.db = db
        self._select_cols = "*"
        self._filters = {}
        self._order_by = None
        self._desc = False
        self._limit = None
        self._mutation_type = None
        self._mutation_record = None

    def select(self, cols: str = "*"):
        self._select_cols = cols
        return self

    def eq(self, col: str, val: Any):
        self._filters[col] = val
        return self

    def order(self, col: str, desc: bool = False):
        self._order_by = col
        self._desc = desc
        return self

    def limit(self, n: int):
        self._limit = n
        return self

    def insert(self, record: Dict[str, Any]):
        self._mutation_type = "insert"
        self._mutation_record = record
        return self

    def upsert(self, record: Dict[str, Any]):
        self._mutation_type = "upsert"
        self._mutation_record = record
        return self

    def delete(self):
        self._mutation_type = "delete"
        return self

    def execute(self) -> QueryResult:
        if self._mutation_type == "insert":
            return self.db.insert(self.table_name, self._mutation_record)
        elif self._mutation_type == "upsert":
            if self.table_name == "summaries":
                return self.db.upsert(self.table_name, self._mutation_record, '("document_id", "language")', ["summary"])
            elif self.table_name == "case_enrollments":
                return self.db.upsert(self.table_name, self._mutation_record, '("user_id", "case_id")')
            else:
                update_cols = [k for k in self._mutation_record.keys() if k != "id"]
                return self.db.upsert(self.table_name, self._mutation_record, '("id")', update_cols)
        elif self._mutation_type == "delete":
            return self.db.delete(self.table_name, self._filters)
        else:
            return self.db.select(
                table=self.table_name,
                cols=self._select_cols,
                filters=self._filters,
                order_by=self._order_by,
                desc=self._desc,
                limit=self._limit
            )


class DatabaseClient:
    def __init__(self, backend_db: DatabaseInterface):
        self.backend = backend_db

    def table(self, table_name: str) -> TableQueryBuilder:
        return TableQueryBuilder(table_name, self.backend)


# Default PostgreSQL connection instance
_connection_url = settings.database_url or "postgresql://postgres:sVdvB4HsAN99qaGv@db.uxsnsredzltdiijsxlmd.supabase.co:5432/postgres"
_pg_db = PostgresDatabase(_connection_url)
db = DatabaseClient(_pg_db)
