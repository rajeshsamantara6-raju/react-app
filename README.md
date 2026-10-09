# ResumeIQ

ResumeIQ is a responsive resume-to-job-description comparison demo. The current workspace uses the existing Create React App setup and Zoho Catalyst Advanced I/O function. A configured function handles keyword and structure heuristics; without a function URL, the browser provides a clearly labeled demo analysis.

## Run the frontend

```powershell
cd react-app
npm install
npm start
```

Run checks with `npm test -- --watchAll=false` and `npm run build`.

## Connect the Catalyst function

Deploy `functions/resume_ats_checker_function` with the Catalyst CLI, then set the deployed function's base URL in `react-app/.env.local`:

```dotenv
REACT_APP_CATALYST_FUNCTION_URL=https://your-function-domain.example
```

Restart the React development server after changing environment variables. The frontend sends JSON to `POST {REACT_APP_CATALYST_FUNCTION_URL}/analyze` with `resumeText` and `jobDescription` strings. The function checks both values, rejects text shorter than 80 characters, and returns a heuristic score breakdown, keyword groups, recommendations, and a disclaimer. Set `ALLOWED_ORIGIN` in the function environment to the deployed frontend origin; the default `*` is intended only for development.

## Analysis and privacy notes

The score is an illustrative text-matching heuristic, not an employer-specific ATS result or a guarantee. The editable `SCORE_WEIGHTS` in the function (and matching demo weights in the frontend) are illustrative 35/25/20/10/10 values, not universal screening criteria.

## Future integration

`REACT_APP_CATALYST_FUNCTION_URL` is the frontend API boundary. Keep credentials and third-party API secrets in Catalyst function environment variables, never in `REACT_APP_*` variables, since those are bundled into the browser app.