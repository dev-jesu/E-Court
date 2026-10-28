-- After registering a user via the app, enroll them in a sample case:
with c as (
  insert into cases (case_number, title, court)
  values ('OS/142/2026', 'Ravi Kumar vs. State Housing Board', 'District Court, Coimbatore')
  returning id
), d as (
  insert into documents (case_id, title, language, content)
  select id, 'Interim Order dated 12-10-2026', 'en',
  'IN THE DISTRICT COURT, COIMBATORE. O.S. No. 142 of 2026. Ravi Kumar (Plaintiff) vs State Housing Board (Defendant). The plaintiff seeks a permanent injunction restraining the defendant from demolishing the structure at Survey No. 55/2. Having heard both sides, this Court directs that status quo be maintained until the next date of hearing. The defendant shall file its written statement within four weeks. List on 20-11-2026.'
  from c
)
insert into case_enrollments (user_id, case_id)
select u.id, c.id from users u, c where u.email = 'YOUR_EMAIL_HERE';
