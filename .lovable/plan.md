

# Insert 25 Notion Documents into Database

## What
Execute your provided INSERT statement to add 25 migrated Notion documents into the `documents` table. These cover scripts, SOPs, training guides, and company resources across departments like Acquisitions, DTS, DTA, Lead Gen, and Operations.

## How
- Run the INSERT SQL via `psql` in the sandbox (exec-based DB access)
- If `psql` is unavailable, use a migration as a fallback
- Verify insertion with a SELECT count query afterward

## Documents Being Added
1. Warm Lead Script
2. Direct to Agent Call Script
3. Lead Lists Master SOP
4. Agent Response Guide
5. Cold Call Script - Seller Lead
6. DTS Call Scripts
7. POF - Proof of Funds
8. Managing DTA Conversations
9. Outbound Seller Lead Calling Guide
10. Our Values
11. Spanish Leads
12. Info Gathering
13. Setting an Appointment
14. Evergreen Ops System
15. Closer Script
16. Getting Started
17. Closer Training Guide
18. Message from CEO
19. POF - Proof of Funds (Reference)
20. JV - Joint Venture
21. Pace Credibility Email
22. Lead Status Description
23. Offer & Negotiation Framework
24. Broker List Building
25. ORBIT Lead Manager Promotion Scorecard

## Note
The `author_id` column is left NULL since these are migrated docs. `author_name` is set to "Migrated from Notion" for attribution.

