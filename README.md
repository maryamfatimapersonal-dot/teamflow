# TeamFlow — Huzaifa's Team Task Manager

A full-stack team productivity web app with Kanban board, Team Tracer, To-Do management, and animated dark-mode UI.

---

## Project Structure

```
teamflow/
├── app.py                  # Flask backend (API + server)
├── data.json               # JSON data store (auto-created)
├── requirements.txt        # Python dependencies
├── startup.txt             # Azure App Service startup command
├── templates/
│   └── index.html          # Main SPA HTML template
└── static/
    ├── css/
    │   └── style.css       # All styles + animations
    └── js/
        └── app.js          # Frontend logic
```

---

## Features

| Feature | Description |
|---|---|
| **Dashboard** | Animated stat cards, activity feed, workload bars |
| **Kanban Board** | Drag-friendly 3-column board (Pending / In Progress / Complete) |
| **Team Tracer** | Per-member task overview in real time |
| **Members View** | Profile cards with per-member statistics |
| **Add / Edit / Delete** | Full CRUD via modal with validation |
| **Priority Levels** | Low / Medium / High with colored badges |
| **Due Date Tracking** | Overdue detection with red highlight |
| **Search & Filter** | Live search + filter by team member |
| **Animated UI** | Floating orbs, grid overlay, staggered card reveals |
| **Responsive** | Mobile sidebar + adaptive grid layouts |

---

## Running Locally

### 1. Install dependencies

```bash
cd teamflow
pip install -r requirements.txt
```

### 2. Run the app

```bash
python app.py
```

### 3. Open in browser

```
http://localhost:5000
```

The app auto-seeds 6 sample tasks on first run.

---

## Deploying to Microsoft Azure App Service

### Prerequisites
- Azure CLI installed and logged in (`az login`)
- An Azure subscription

### Option A — Azure CLI (Recommended)

```bash
# 1. Create a resource group
az group create --name teamflow-rg --location eastus

# 2. Create an App Service plan (Free tier)
az appservice plan create \
  --name teamflow-plan \
  --resource-group teamflow-rg \
  --sku B1 \
  --is-linux

# 3. Create the web app (Python 3.11)
az webapp create \
  --name teamflow-huzaifa \
  --resource-group teamflow-rg \
  --plan teamflow-plan \
  --runtime "PYTHON:3.11"

# 4. Set startup command
az webapp config set \
  --name teamflow-huzaifa \
  --resource-group teamflow-rg \
  --startup-file "gunicorn --bind=0.0.0.0 --timeout 600 app:app"

# 5. Deploy via ZIP
zip -r teamflow.zip . -x "*.pyc" -x "__pycache__/*" -x ".venv/*"

az webapp deploy \
  --name teamflow-huzaifa \
  --resource-group teamflow-rg \
  --src-path teamflow.zip \
  --type zip
```

### Option B — GitHub Actions (CI/CD)

1. Push this project to a GitHub repo.
2. In Azure Portal → Your App → Deployment Center → GitHub → Connect your repo.
3. Azure auto-generates a GitHub Actions workflow for Python.

### Important Azure Notes

- `data.json` is stored on the App Service filesystem. For production, swap this for **Azure Cosmos DB** or **Azure Table Storage** to persist data across restarts/deployments.
- Set `FLASK_ENV=production` in App Service → Configuration → Application Settings.
- The `/health` endpoint is pre-configured for Azure health checks.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tasks` | List all tasks |
| POST | `/api/tasks` | Create a task |
| GET | `/api/tasks/<id>` | Get single task |
| PUT | `/api/tasks/<id>` | Update task |
| PATCH | `/api/tasks/<id>/status` | Quick status update |
| DELETE | `/api/tasks/<id>` | Delete task |
| GET | `/api/stats` | Team summary statistics |
| GET | `/health` | Health check |

### Task Object

```json
{
  "id": 1,
  "title": "Design new dashboard",
  "description": "Create wireframes...",
  "member": "Maryam Duryab",
  "status": "in_progress",
  "priority": "high",
  "due_date": "2025-01-31",
  "created_at": "2025-01-01T12:00:00"
}
```

Valid values:
- `member`: `"Huzaifa"` | `"Maryam Duryab"` | `"Mohsin"`
- `status`: `"pending"` | `"in_progress"` | `"complete"`
- `priority`: `"low"` | `"medium"` | `"high"`

---

## Team

| Member | Role |
|---|---|
| Huzaifa | Team Lead |
| Maryam Duryab | Developer |
| Mohsin | Designer |
