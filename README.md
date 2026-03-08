# ReadRight - AI Legal Assistant

Instantly analyze legal risks, understand complex language, and rewrite confusing clauses into plain English.

This project is a full-stack Next.js application that leverages a Python (FastAPI) backend. It is designed to be fully deployable as a single full-stack app on **Vercel** utilizing Vercel's Python Serverless Functions.

## Architecture
- **Frontend**: Next.js 15 (App Router), React 19, TailwindCSS, Framer Motion
- **Backend**: Python 3.9+, FastAPI, pypdf, Groq
- **Deployment**: Vercel Serverless (Next.js handling UI, `/api` routing to Python)

## How to Run Locally

### 1. Start the Python Backend
The Python API runs on port 8000. Install the dependencies and start the uvicorn fastAPI server.
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r api/requirements.txt
uvicorn api.index:app --reload --port 8000
```
*(Make sure you have an `GROQ_API_KEY` exported in your environment or set in `.env` for the Rewrite capability to work).*

### 2. Start the Next.js Frontend
In a new terminal window, start the Next.js development server:
```bash
npm install
npm run dev
```
Navigate to `http://localhost:3000`. Next.js development server will automatically proxy requests matching `/api/*` to the Python server running on `http://localhost:8000`.

## How to Deploy to Vercel

Deployment to Vercel is basically a one-click process. 

1. **Commit your code to GitHub.**
2. **Log into Vercel and import your GitHub Repository.**
3. **Configure Settings:**
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (Default)
   - **Build Command**: `npm run build` (Default)
   - **Environment Variables**: Add your `GROQ_API_KEY`.
4. **Deploy:** Click "Deploy".
   - Vercel will automatically build the Next.js frontend and detect the `api/` folder and `vercel.json` to handle the FastAPI python routing without needing any extra configuration.

## Features
- **Premium Design:** Glassmorphism, animations, gradients, and dynamic drag-and-drop.
- **Risk Hotspot Highlighting:** AI-driven text assessment utilizing complex sentence flagging.
- **Plain English Translations:** Connects to Groq's fast and free Llama 3 API to rewrite complex legal clauses intuitively.
