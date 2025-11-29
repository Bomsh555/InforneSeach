# InforneSeach — Local dev server (auth)

This project adds a minimal Node.js server with simple registration and login backed by SQLite.

How to run (Windows PowerShell):

1. Open PowerShell in the project folder `c:\Users\user\Desktop\ДОКС САЙТ`
2. Install dependencies:

```powershell
cd "c:\Users\user\Desktop\ДОКС САЙТ\server"
npm install
```

3. Start the server:

```powershell
npm start
```

4. Open in browser:

```powershell
# open home page served by server
ii http://localhost:3000
```

Notes:
- The server serves static files from the project root so you should open the site via `http://localhost:3000`.
- The database file `users.db` will be created inside the `server/` folder.
- This is a minimal example — in production use HTTPS, session management or JWTs, email verification, rate-limiting, input sanitization, and stronger password policies.