"""
TeamFlow — Flask Backend
Run locally:  python app.py
Azure:        Gunicorn via startup command or Azure App Service auto-detection
"""

import json
import os
from datetime import datetime
from flask import Flask, jsonify, request, render_template, abort

# ── App Setup ──────────────────────────────────────────────────────────────── #
app = Flask(__name__)

# Manual CORS headers (no flask-cors dependency needed)
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    return response

# Data file lives next to app.py
DATA_FILE = os.path.join(os.path.dirname(__file__), 'data.json')

VALID_STATUSES  = {'pending', 'in_progress', 'complete'}
VALID_MEMBERS   = {'Huzaifa', 'Maryam Duryab', 'Mohsin'}
VALID_PRIORITIES= {'low', 'medium', 'high'}

# ── Data Helpers ────────────────────────────────────────────────────────────── #
def load_data() -> dict:
    """Load tasks from JSON file, initialise if missing/corrupt."""
    if not os.path.exists(DATA_FILE):
        return {"tasks": []}
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {"tasks": []}


def save_data(data: dict) -> None:
    """Persist tasks to JSON file atomically (write-then-rename)."""
    tmp = DATA_FILE + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, DATA_FILE)


def next_id(tasks: list) -> int:
    """Auto-increment integer ID."""
    return max((t.get('id', 0) for t in tasks), default=0) + 1


# ── Seed default tasks if file is empty ─────────────────────────────────────── #
def seed_defaults():
    data = load_data()
    if not data.get('tasks'):
        data['tasks'] = [
            {
                "id": 1,
                "title": "Design the new dashboard UI",
                "description": "Create wireframes and high-fidelity designs for the team dashboard.",
                "member": "Maryam Duryab",
                "status": "complete",
                "priority": "high",
                "due_date": "2024-12-31",
                "created_at": datetime.utcnow().isoformat()
            },
            {
                "id": 2,
                "title": "Set up Flask API endpoints",
                "description": "Build RESTful API for task CRUD operations.",
                "member": "Huzaifa",
                "status": "complete",
                "priority": "high",
                "due_date": "2025-01-10",
                "created_at": datetime.utcnow().isoformat()
            },
            {
                "id": 3,
                "title": "Frontend Kanban integration",
                "description": "Connect the Kanban board to the live Flask API.",
                "member": "Huzaifa",
                "status": "in_progress",
                "priority": "high",
                "due_date": "2025-01-20",
                "created_at": datetime.utcnow().isoformat()
            },
            {
                "id": 4,
                "title": "Write unit tests for API",
                "description": "Cover all endpoints with pytest test cases.",
                "member": "Mohsin",
                "status": "pending",
                "priority": "medium",
                "due_date": "2025-01-25",
                "created_at": datetime.utcnow().isoformat()
            },
            {
                "id": 5,
                "title": "Mobile responsiveness polish",
                "description": "Fix layout issues on smaller screens.",
                "member": "Maryam Duryab",
                "status": "in_progress",
                "priority": "medium",
                "due_date": "2025-01-22",
                "created_at": datetime.utcnow().isoformat()
            },
            {
                "id": 6,
                "title": "Deploy to Azure App Service",
                "description": "Configure CI/CD pipeline and deploy the full app to Azure.",
                "member": "Mohsin",
                "status": "pending",
                "priority": "high",
                "due_date": "2025-01-30",
                "created_at": datetime.utcnow().isoformat()
            },
        ]
        save_data(data)


# ── Routes ───────────────────────────────────────────────────────────────────── #

@app.route('/')
def index():
    """Serve the main SPA shell."""
    return render_template('index.html')


# GET /api/tasks  — list all tasks
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    data = load_data()
    return jsonify(data.get('tasks', []))


# POST /api/tasks  — create task
@app.route('/api/tasks', methods=['POST'])
def create_task():
    body = request.get_json(silent=True) or {}

    title = (body.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'title is required'}), 400

    member = body.get('member', 'Huzaifa')
    if member not in VALID_MEMBERS:
        return jsonify({'error': f'member must be one of {sorted(VALID_MEMBERS)}'}), 400

    status = body.get('status', 'pending')
    if status not in VALID_STATUSES:
        return jsonify({'error': f'status must be one of {sorted(VALID_STATUSES)}'}), 400

    priority = body.get('priority', 'medium')
    if priority not in VALID_PRIORITIES:
        priority = 'medium'

    data = load_data()
    task = {
        'id':          next_id(data['tasks']),
        'title':       title,
        'description': (body.get('description') or '').strip(),
        'member':      member,
        'status':      status,
        'priority':    priority,
        'due_date':    body.get('due_date') or '',
        'created_at':  datetime.utcnow().isoformat(),
    }
    data['tasks'].append(task)
    save_data(data)
    return jsonify(task), 201


# GET /api/tasks/<id>  — single task
@app.route('/api/tasks/<int:task_id>', methods=['GET'])
def get_task(task_id):
    data = load_data()
    task = next((t for t in data['tasks'] if t['id'] == task_id), None)
    if not task:
        abort(404)
    return jsonify(task)


# PUT /api/tasks/<id>  — full update
@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    data = load_data()
    task = next((t for t in data['tasks'] if t['id'] == task_id), None)
    if not task:
        abort(404)

    body = request.get_json(silent=True) or {}

    title = (body.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'title is required'}), 400

    member = body.get('member', task['member'])
    if member not in VALID_MEMBERS:
        return jsonify({'error': f'member must be one of {sorted(VALID_MEMBERS)}'}), 400

    status = body.get('status', task['status'])
    if status not in VALID_STATUSES:
        return jsonify({'error': f'status must be one of {sorted(VALID_STATUSES)}'}), 400

    priority = body.get('priority', task.get('priority', 'medium'))
    if priority not in VALID_PRIORITIES:
        priority = 'medium'

    task['title']       = title
    task['description'] = (body.get('description') or '').strip()
    task['member']      = member
    task['status']      = status
    task['priority']    = priority
    task['due_date']    = body.get('due_date') or task.get('due_date', '')
    task['updated_at']  = datetime.utcnow().isoformat()

    save_data(data)
    return jsonify(task)


# PATCH /api/tasks/<id>/status  — quick status flip
@app.route('/api/tasks/<int:task_id>/status', methods=['PATCH'])
def patch_status(task_id):
    data = load_data()
    task = next((t for t in data['tasks'] if t['id'] == task_id), None)
    if not task:
        abort(404)

    body   = request.get_json(silent=True) or {}
    status = body.get('status')
    if status not in VALID_STATUSES:
        return jsonify({'error': 'invalid status'}), 400

    task['status']     = status
    task['updated_at'] = datetime.utcnow().isoformat()
    save_data(data)
    return jsonify(task)


# DELETE /api/tasks/<id>
@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    data = load_data()
    original_len = len(data['tasks'])
    data['tasks'] = [t for t in data['tasks'] if t['id'] != task_id]
    if len(data['tasks']) == original_len:
        abort(404)
    save_data(data)
    return jsonify({'deleted': task_id}), 200


# GET /api/stats — summary stats
@app.route('/api/stats', methods=['GET'])
def get_stats():
    data  = load_data()
    tasks = data.get('tasks', [])
    stats = {
        'total':       len(tasks),
        'complete':    sum(1 for t in tasks if t['status'] == 'complete'),
        'in_progress': sum(1 for t in tasks if t['status'] == 'in_progress'),
        'pending':     sum(1 for t in tasks if t['status'] == 'pending'),
        'by_member': {
            m: {
                'total':       sum(1 for t in tasks if t['member'] == m),
                'complete':    sum(1 for t in tasks if t['member'] == m and t['status'] == 'complete'),
                'in_progress': sum(1 for t in tasks if t['member'] == m and t['status'] == 'in_progress'),
                'pending':     sum(1 for t in tasks if t['member'] == m and t['status'] == 'pending'),
            }
            for m in VALID_MEMBERS
        }
    }
    return jsonify(stats)


# ── Health Check (required by Azure) ──────────────────────────────────────── #
@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'app': 'TeamFlow'}), 200


# ── Error Handlers ──────────────────────────────────────────────────────────── #
@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(400)
def bad_request(e):
    return jsonify({'error': 'Bad request'}), 400

@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500


# ── Entry Point ─────────────────────────────────────────────────────────────── #
if __name__ == '__main__':
    seed_defaults()
    # Azure sets PORT env variable; default to 5000 for local dev
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV', 'development') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)
