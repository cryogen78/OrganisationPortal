OrganisationPortal Report
This document provides a complete functionality and technical overview of the OrganisationPortal project developed for internal document management within an organisation or banking environment.
Project Purpose
OrganisationPortal is a locally hosted internal document management system that allows secure user login, admin-controlled document uploads, document viewing/downloading, announcements, and storage monitoring.
Technologies Used
- Node.js
- Express.js
- SQLite3
- EJS Templates
- Multer
- Express Session
Main Features
- Secure Login System
- Admin Upload Controls
- Multiple File Upload Support
- Large File Upload Capability
- Announcements System
- Search and Filter Documents
- Date-based Filtering
- Storage Usage Monitoring
- Responsive Orange Theme Dashboard
- Multi-user Access
Database Tables
1. users
2. documents
3. announcements
Admin Functionalities
- Upload documents
- Upload multiple documents simultaneously
- Post announcements
- Manage organisational documents
User Functionalities
- Login securely
- View uploaded documents
- Download documents
- Search documents by name
- Filter by upload date
Storage Monitoring
The dashboard displays real D Drive storage usage using WMIC commands and visualizes total/used storage with progress bars.
Project Structure
Important files and folders:
- server.js
- database.db
- views/
- uploads/
- package.json
- node_modules/
How To Run The Project
1. Install Node.js
2. Open terminal in project folder
3. Run npm install
4. Run node server.js
5. Open http://localhost:3000
GitHub Project Description
OrganisationPortal is a secure internal document management system designed for organisations and banks. It provides admin-controlled document uploads, multi-user login, announcements, storage monitoring, and a modern responsive dashboard interface.

This project demonstrates full-stack local web application development using Node.js, Express, SQLite, and EJS for enterprise internal use cases.
