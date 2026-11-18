# Care Notes Frontend

This is a small, dependency-free frontend for the Care Notes API.

## Run

1. Start MongoDB and the backend using the [Backend setup guide](https://github.com/DiptoAc/care-guide-backend#care-notes-api).
2. From this directory, run `npm start`.
3. Open `http://localhost:3000`.

The API URL defaults to `http://localhost:5000/api` and can be changed on the sign-in screen. The backend's `CORS_ORIGIN` should match the frontend origin (`http://localhost:3000` by default).

## Included flows

- Register and sign in; the JWT is kept in browser local storage.
- Create, list, edit and delete notes.
- Browse and publish community posts, and view your own posts.
- Admin tools for paginated user management, role changes, user deletion, and all-note access.
- Admin interest groups and per-user post lookup.

Admin tools require an account whose role is `admin`; public registration always creates a regular user.

## Deploy to Vercel

1. Import this folder's GitHub repository into Vercel.
2. Set the project root to the repository root and the build command to `npm run build`.
3. Set `API_BASE_URL` to the deployed backend URL followed by `/api`, for example `https://care-guide-backend.onrender.com/api`.
4. Deploy. The build writes the API URL into `dist/api-config.js`; no API URL needs to be manually entered by visitors.
5. Add the deployed frontend origin to the backend's `CORS_ORIGIN` setting and redeploy/restart the backend.

## Deploy to Netlify

The included `netlify.toml` sets the build command, publish directory, and production API URL. Import this repository into Netlify and deploy from its root. Add the Netlify production domain to the backend's comma-separated `CORS_ORIGIN` list alongside the Vercel domain so both frontends can use the API.
