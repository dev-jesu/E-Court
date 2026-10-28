# E-Court Intelligence & Document Summarizer Portal

A secure, multi-tenant judicial document intelligence portal and multilingual summarization workspace for advocates, legal practitioners, and litigants.

## Key Features

- **Split-Screen Authentication:** Clean, distraction-free sign-in featuring legal quotes and role-based access control.
- **Enrolled Proceedings Docket:** Advocates and litigants only access cases and proceedings they are officially enrolled in.
- **Integrated PDF Document Viewer:** Directly inspect original judgments and court filings in an embedded full-screen viewer with download capability.
- **Multilingual AI Summarizer:** Generates structured legal summaries in multiple Indian languages (English, Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati) using Groq LLM with database caching.
- **Administration & Case Management:** Authorized administrators can register new cases, upload and extract court orders/pleadings, and manage advocate/litigant access by email.
- **Resilient Database Architecture:** High-performance connection pooling with automatic reconnection handling for PostgreSQL / Supabase.

---

## Tech Stack

- **Frontend:** React (Vite), Modern Vanilla CSS design system (light theme, responsive, accessible typography).
- **Backend:** FastAPI (Python 3.12), Uvicorn, PyPDF/pdfplumber text extraction.
- **Database:** Supabase PostgreSQL with pooled connection management.
- **AI / LLM:** Groq API (`qwen/qwen3.8-27b`) or Anthropic Claude with caching.
- **Security:** HTTP-only Bearer JWT authentication, bcrypt password hashing.

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+ & npm
- PostgreSQL database (e.g. Supabase)
- Groq API Key

---

### 1. Database Setup
1. Create a PostgreSQL database on [Supabase](https://supabase.com).
2. Open the **SQL Editor** and run [schema.sql](./schema.sql) to initialize tables and indexes.
3. (Optional) Run [seed.sql](./seed.sql) to add sample proceedings.

---

### 2. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL, GROQ_API_KEY, and JWT_SECRET

# Start FastAPI server
python -m uvicorn app.main:app --reload --port 8000
```

---

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# VITE_API_URL defaults to http://localhost:8000

# Start development server
npm run dev
```

The application will be accessible at `http://localhost:5173`.

---

### 4. Admin Account Setup
1. Register a new user in the web application (e.g., `admin@court.in`).
2. Promote the user to administrator via SQL:
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'admin@court.in';
   ```
3. Sign in again. An **Admin Panel** button will now be accessible in the top navigation bar.

---

## Project Structure
```text
├── backend/
│   ├── app/
│   │   ├── auth.py          # JWT authentication & password hashing
│   │   ├── config.py        # Pydantic environment settings
│   │   ├── db.py            # Resilient PostgreSQL pool connection
│   │   ├── llm.py           # Multi-provider summarizer (Groq/Anthropic)
│   │   └── main.py          # FastAPI routes and PDF file serving
│   ├── uploads/             # Attached case judgment PDFs
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Backend environment template
├── frontend/
│   ├── src/
│   │   ├── Admin.jsx        # Admin case docket & party enrollment
│   │   ├── App.jsx          # Root application routing
│   │   ├── Login.jsx        # Split-screen sign-in with quotes
│   │   ├── Workspace.jsx    # Advocate workspace & PDF viewer modal
│   │   ├── api.js           # Centralized API service client
│   │   └── styles.css       # Clean, modern legal design system
│   └── package.json
├── docs/                    # Sample Supreme Court judgment documents
├── schema.sql               # Database schema definition
├── seed.sql                 # Sample test records
└── README.md
```
