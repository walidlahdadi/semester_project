from flask import (
    Flask, jsonify, render_template, request, redirect,
    send_from_directory, url_for, send_file
)
from flask_mysqldb import MySQL
from flask_login import (
    LoginManager, UserMixin, login_user,
    login_required, logout_user, current_user
)
import subprocess
import threading
import json
import re
import os
import bcrypt
import glob
import logging
from io import BytesIO
from datetime import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    Paragraph, SimpleDocTemplate, Spacer, Table,
    TableStyle, PageBreak, Flowable, Image
)
from reportlab.lib.enums import TA_CENTER
from reportlab.lib import colors
from reportlab.lib.units import inch

# Author : LAHDADI Walid

app = Flask(__name__)

app.secret_key = os.environ.get('d2f8a9b4c7e6f5a3b8c7d6e5f4a3b2c1', 'fallback_secret_key_for_development')

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# User class for Flask-Login
class User(UserMixin):
    def __init__(self, id):
        self.id = id

# Load user callback for Flask-Login
@login_manager.user_loader
def load_user(user_id):
    return User(user_id)

@app.route('/')
def home():
    return redirect('/login')

@login_required 
@app.route('/home')
def home_page():
    return render_template('home.html')

@app.route('/get_chart_data')
def get_chart_data():
    chart_data = {
        "memory": {"labels": ["Process 1", "Process 2", "Process 3"], "values": [30, 45, 20]},
        "disk": {"labels": ["File 1", "File 2", "File 3"], "values": [10, 15, 35]},
        "network": {"labels": ["Connection 1", "Connection 2", "Connection 3"], "values": [25, 50, 40]}
    }
    return jsonify(chart_data)


# Configuration de la base de données MySQL
app.config['MYSQL_HOST'] = 'localhost'
app.config['MYSQL_USER'] = ''
app.config['MYSQL_PASSWORD'] = ''
app.config['MYSQL_DB'] = ''

mysql = MySQL(app) 


analysis_results = []
DUMP_DIR = r"C:\Users\walid\Desktop\dump_memory"
METADATA_FILE_PATH = os.path.join(DUMP_DIR, 'metadata.json')
OUTPUT_DIR = r"C:\Users\walid\Desktop\output_volatility"
@app.route("/start-analysis", methods=["POST"])
def start_analysis():
    data = request.json
    with open(METADATA_FILE_PATH, 'r') as f:
        metadata_list = json.load(f)
    for dump in data["dumps"]:
        dump_name = dump["dumpName"]
        found = False
        for entry in metadata_list:
            if entry["name"] == dump_name:
                os_type = entry.get("os", "windows")
                found = True
                break
        if not found:
            os_type = "windows"
        dump_path = os.path.join(DUMP_DIR, dump_name)
        for plugin in dump["plugins"]:
            threading.Thread(
                target=run_analysis,
                args=(dump_path, os_type, plugin)
            ).start()
    return jsonify({"success": True})

@login_required 
@app.route("/fetch-results", methods=["GET"])
def fetch_results():
    return jsonify({"results": analysis_results})

def run_analysis(dump_path, os_type, plugin):
    """Run Volatility3 analysis with JSON output and save the results."""
    try:
        base_dir = r"C:\Users\walid\Desktop\volatility3-develop"
        plugin_map = {
            "pslist": "PsList",
            "psscan": "PsScan",
            "pstree": "PsTree",
            "psxview": "PsXView",
            "netscan": "NetScan",
            "dlllist": "DllList",
            "psaux": "PsAux",
            "malfind": "Malfind",
            "lsmod": "Lsmod",
            "modules": "Modules"
        }
        
        plugin_name = plugin_map.get(plugin.lower(), plugin)
        
        if os_type.lower() == "windows":
            full_plugin_name = f"windows.{plugin.lower()}.{plugin_name}"
            command = [
                "py",
                os.path.join(base_dir, "vol.py"),
                "-r", "json",
                "-f", dump_path,
                full_plugin_name
            ]
        elif os_type.lower() == "linux":
            full_plugin_name = f"linux.{plugin.lower()}.{plugin_name}"
            command = [
                "py",
                os.path.join(base_dir, "vol.py"),
                "-r", "json",
                "-f", dump_path,
                full_plugin_name
            ]
        else:
            raise ValueError("Unsupported OS type")
        
        print(f"Running command: {' '.join(command)}")
        
        result = subprocess.run(command, capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"Command succeeded for {dump_path} with plugin {full_plugin_name}")
        else:
            print(f"Command failed for {dump_path} with plugin {full_plugin_name}")
            print(f"Error: {result.stderr}")
        
        analysis_results.append({
            "dumpName": os.path.basename(dump_path),
            "plugin": full_plugin_name,
            "output": result.stdout
        })
        
        # Output file path
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        output_path = os.path.join(OUTPUT_DIR, f"{os.path.basename(dump_path)}_{plugin}.json")
        
        # Save results to a JSON file
        with open(output_path, "w") as json_file:
            json.dump({"output": json.loads(result.stdout)}, json_file)
            print(f"Results saved to: {output_path}")
            
    except Exception as e:
        print(f"Error running analysis for {dump_path}: {e}")


OUTPUT_DIR = r"C:\Users\walid\Desktop\output_volatility"
@login_required 
@app.route("/get_plugin_result/<string:dump_name>/<string:plugin_name>", methods=["GET"])
def get_plugin_result(dump_name, plugin_name):
    try:
        output_path = os.path.join(OUTPUT_DIR, f"{dump_name}_{plugin_name}.json")
        if not os.path.exists(output_path):
            return jsonify({"error": f"Result file for plugin '{plugin_name}' not found."}), 404
        with open(output_path, "r") as result_file:
            result_data = json.load(result_file)

        return jsonify(result_data) 
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@login_required 
@app.route("/save-comparison-results", methods=["POST"])
def save_comparison_results():
    data = request.json
    dump_name = data["dumpName"]
    missing_processes = data["missingProcesses"]

    output_dir = r"C:\Users\walid\Desktop\output_volatility\Analysis_results"
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, f"{dump_name}_pslist_pscan_comparison.json")

    with open(output_path, "w") as json_file:
        json.dump({"missingProcesses": missing_processes}, json_file)

    return jsonify({"success": True})

@app.route("/get-analysis-results", methods=["GET"])
def get_analysis_results():
    output_dir = r"C:\Users\walid\Desktop\output_volatility\analysis_results"
    if not os.path.exists(output_dir):
        return jsonify([])

    analysis_results = []
    for filename in os.listdir(output_dir):
        if filename.endswith(".json"):
            parts = filename.split("_")
            if len(parts) >= 3:
                dump_name = parts[0]
                result_type = parts[1]
                file_path = os.path.join(output_dir, filename)
                with open(file_path, "r") as json_file:
                    data = json.load(json_file)
                    analysis_results.append({
                        "dumpName": dump_name,
                        "resultType": result_type,
                        "results": data
                    })
    return jsonify(analysis_results)

OUTPUT_MEM = r"C:\Users\walid\Desktop\output_volatility\Memmap_results"
@app.route("/run_plugin/<dump_name>/<int:pid>/<process_name>", methods=["GET"])
def run_plugin(dump_name, pid, process_name):
    """Run memmap plugin and name file with dump name, process name, and PID."""
    try:
        dump_path = os.path.join(r"C:\Users\walid\Desktop\dump_memory", dump_name)
        vol_path = r"C:\Users\walid\Desktop\volatility3-develop\vol.py"

        sanitized_process = re.sub(r'[\\/*?:"<>|]', '_', process_name)
        
        output_filename = f"{dump_name}_{sanitized_process}_{pid}_Memmap.dump"
        output_path = os.path.join(OUTPUT_MEM, output_filename)

        # Run Volatility command
        command = [
            "py",
            vol_path,
            "-f", dump_path,
            "windows.memmap.Memmap",
            "--pid", str(pid)
        ]
        result = subprocess.run(command, capture_output=True, text=True)

        if result.returncode == 0:
            with open(output_path, "w") as f:
                f.write(result.stdout)
            return jsonify({"status": "success", "outputPath": output_path})
        else:
            return jsonify({"status": "error", "message": result.stderr}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

class ProcessTreeFlowable(Flowable):
    """Compact process tree visualization"""
    def __init__(self, process, depth=0):
        Flowable.__init__(self)
        self.process = process
        self.depth = depth
        self.width = 6 * inch
        self.height = 0.25 * inch 

    def draw(self):
        canv = self.canv
        canv.saveState()
        
        indent_per_level = 0.2 * inch
        bullet_radius = 3
        line_color = colors.HexColor('#6c757d')
        text_color = colors.HexColor('#2c3e50')
        font_name = 'Helvetica'
        
        x = indent_per_level * self.depth
        y = self.height - 0.15 * inch 
        
        if self.depth > 0:
            canv.setStrokeColor(line_color)
            canv.setLineWidth(0.3)
            canv.line(x - indent_per_level, y + 0.1 * inch,
                      x - indent_per_level, y - 0.1 * inch)
            canv.line(x - indent_per_level, y - 0.1 * inch,
                      x, y - 0.1 * inch)

        bullet_color = colors.HexColor('#3498db') if self.depth == 0 else colors.HexColor('#e74c3c')
        canv.setFillColor(bullet_color)
        canv.circle(x + bullet_radius, y, bullet_radius, fill=1)
        
        canv.setFont(font_name, 8 if self.depth > 0 else 9)  # Smaller font for children
        canv.setFillColor(text_color)
        text = f"{self.process.get('ImageFileName', 'N/A')} ({self.process.get('PID', '?')})"
        canv.drawString(x + 3 * bullet_radius, y - 3, text)  # Tight text positioning
        
        canv.restoreState()

    def wrap(self, availWidth, availHeight):
        return (self.width, self.height)

def add_process_tree(process, story, depth=0):
    """Add process tree with minimal spacing"""
    story.append(ProcessTreeFlowable(process, depth))
    
    if depth == 0:
        story.append(Spacer(1, 0.1 * inch))
    
    for child in process.get('__children', []):
        add_process_tree(child, story, depth + 1)

@app.route('/generate_report/<string:dump_name>', methods=['GET'])
def generate_report(dump_name):
    buffer = BytesIO()
    pdf = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    # --- First Page: Title and Analysis ---
    title = Paragraph("Report Volatility3", styles['Title'])
    story.append(title)
    story.append(Spacer(1, 12))

    # Dump Info
    dump_info = f"""
    Dump Memory Name: {dump_name}<br/>
    Date and Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}<br/>
    Analysis plugins: pslist, psscan, pstree
    """
    story.append(Paragraph(dump_info, styles['BodyText']))
    story.append(Spacer(1, 12))

    # Missing Processes Analysis
    analysis_text = "Analysis of pslist and psscan:<br/>"
    story.append(Paragraph(analysis_text, styles['BodyText']))
    story.append(Spacer(1, 12))
    
    missing_processes = get_missing_processes(dump_name)
    if missing_processes:
        missing_pids_text = "Missing PIDs:<br/>"
        for process in missing_processes:
            missing_pids_text += f"PID: {process['PID']}, Name: {process['Name']}<br/>"
    else:
        missing_pids_text = "No missing PIDs found."
    
    story.append(Paragraph(missing_pids_text, styles['BodyText']))
    story.append(PageBreak())

    # --- Process Tree Visualization ---
    pstree_path = os.path.join(OUTPUT_DIR, f"{dump_name}_pstree.json")
    if os.path.exists(pstree_path):
        try:
            with open(pstree_path, 'r') as f:
                pstree_data = json.load(f).get('output', [])

            tree_title = Paragraph(
                "<font name='Helvetica-Bold' size=14 color='#2c3e50'>Process Hierarchy Visualization</font>",
                styles['Heading2']
            )
            story.append(tree_title)
            story.append(Spacer(1, 0.3 * inch))

            legend_style = ParagraphStyle(
                'Legend',
                parent=styles['BodyText'],
                fontSize=8,
                textColor=colors.HexColor('#7f8c8d')
            )
            legend = Paragraph(
                "● <font color='#3498db'>Blue nodes</font> = Root processes | "
                "● <font color='#e74c3c'>Red nodes</font> = Child processes",
                legend_style
            )
            story.append(legend)
            story.append(Spacer(1, 0.2 * inch))
            root_processes = [p for p in pstree_data if p.get('PPID') == 0 or p.get('PPID') not in [proc['PID'] for proc in pstree_data]]
            for proc in root_processes:
                add_process_tree(proc, story)
                story.append(Spacer(1, 0.3 * inch))

            story.append(PageBreak())
        except Exception as e:
            error_msg = Paragraph(f"Error processing process tree: {str(e)}", styles['BodyText'])
            story.append(error_msg)

    plugins = ['pslist', 'psscan']
    for plugin in plugins:
        plugin_title = Paragraph(f"{plugin.capitalize()} Results", styles['Heading2'])
        story.append(plugin_title)
        story.append(Spacer(1, 12))

        output_path = os.path.join(OUTPUT_DIR, f"{dump_name}_{plugin}.json")
        
        if not os.path.exists(output_path):
            story.append(Paragraph(f"No data found for {plugin}.", styles['BodyText']))
            continue

        try:
            with open(output_path, 'r') as f:
                plugin_data = json.load(f).get('output', [])

            table_data = [
                ['PID', 'PPID', 'Offset(V)', 'ImageFileName', 'Threads', 'Handles']
            ]
            
            for entry in plugin_data:
                offset_v = entry.get('Offset(V)', 'N/A')
                try:
                    offset_hex = f"0x{int(offset_v):X}" if isinstance(offset_v, (int, float)) else 'N/A'
                except:
                    offset_hex = 'N/A'

                row = [
                    str(entry.get('PID', 'N/A')),
                    str(entry.get('PPID', 'N/A')),
                    offset_hex,
                    entry.get('ImageFileName', 'N/A'),
                    str(entry.get('Threads', 'N/A')),
                    str(entry.get('Handles', 'N/A'))
                ]
                table_data.append(row)

            table = Table(table_data, repeatRows=1)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#007bff')),
                ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0,0), (-1,0), 12),
                ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f8f9fa')),
                ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#dee2e6')),
            ]))
            
            story.append(table)
            story.append(PageBreak())

        except Exception as e:
            error_msg = Paragraph(f"Error loading {plugin} data: {str(e)}", styles['BodyText'])
            story.append(error_msg)

    # --- Final PDF Build ---
    pdf.build(story)
    buffer.seek(0)
    report_path = os.path.join(REPORTS_DIR, f'report_{dump_name}.pdf')
    with open(report_path, 'wb') as f:
        f.write(buffer.getvalue())

    return jsonify({'success': True, 'report_name': f'report_{dump_name}.pdf'})

def add_compact_process_tree(process, story, depth=0):
    story.append(CompactProcessFlowable(process, depth))
    for child in process.get('__children', []):
        add_compact_process_tree(child, story, depth + 1)

class CompactProcessFlowable(Flowable):
    """Optimized process node display"""
    def __init__(self, process, depth=0):
        Flowable.__init__(self)
        self.process = process
        self.depth = depth
        self.width = 7 * inch
        self.height = 0.2 * inch

    def draw(self):
        canv = self.canv
        canv.saveState()
        
        indent = 0.3 * inch * self.depth
        text = f"{self.process.get('ImageFileName', 'N/A')} (PID: {self.process.get('PID', '?')})"
        
        if self.depth > 0:
            canv.setStrokeColor(colors.HexColor('#457b9d'))
            canv.setLineWidth(0.5)
            canv.line(indent - 0.3*inch, 0.1*inch, indent - 0.3*inch, -0.1*inch)
            canv.line(indent - 0.3*inch, -0.1*inch, indent, -0.1*inch)

        canv.setFillColor(colors.HexColor('#1d3557') if self.depth == 0 else colors.HexColor('#e63946'))
        canv.circle(indent + 0.1*inch, 0.05*inch, 0.05*inch, fill=1)
        canv.setFont('Helvetica', 8 if self.depth > 0 else 9)
        canv.setFillColor(colors.black)
        canv.drawString(indent + 0.3*inch, 0, text)
        
        canv.restoreState()

    def wrap(self, *args):
        return (self.width, self.height)

def get_missing_processes(dump_name):
    # Load the comparison results from the JSON file
    output_path = os.path.join(OUTPUT_DIR, f"{dump_name}_pslist_pscan_comparison.json")
    if os.path.exists(output_path):
        with open(output_path, "r") as json_file:
            data = json.load(json_file)
            return data.get("missingProcesses", [])
    return[] 

REPORTS_DIR = r"C:\Users\walid\Desktop\output_volatility\reports"
@app.route('/reports')

def reports():
    reports = [f for f in os.listdir(REPORTS_DIR) if f.endswith('.pdf')]
    print(reports) 
    return render_template('report.html', reports=reports)


@app.route('/view_report/<filename>')
def view_report(filename):
    return send_from_directory(REPORTS_DIR, filename, as_attachment=False)

@app.route('/download_report/<string:filename>', methods=['GET'])
def download_report(filename):
    return send_from_directory(REPORTS_DIR, filename, as_attachment=True)



def get_missing_processes(dump_name):
    # Load the comparison results from the JSON file
    output_path = os.path.join(OUTPUT_DIR, f"{dump_name}_pslist_pscan_comparison.json")
    if os.path.exists(output_path):
        with open(output_path, "r") as json_file:
            data = json.load(json_file)
            return data.get("missingProcesses", [])
    return []


@app.route('/get_reports', methods=['GET'])
def get_reports():
    reports_dir = r"C:\Users\walid\Desktop\output_volatility\reports"
    if not os.path.exists(reports_dir):
        return jsonify([])
    report_files = [f for f in os.listdir(reports_dir) if f.endswith('.pdf')]
    return jsonify(report_files)

@app.route('/login', methods=['GET', 'POST'])
def login():
    error_message = None
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        if not username or not password:
            error_message = "Please provide both username and password."
        else:
            cursor = mysql.connection.cursor()
            cursor.execute("SELECT password FROM users WHERE email = %s", (username,))
            user = cursor.fetchone()
            cursor.close()

            if user:
                stored_password = user[0]
                if bcrypt.checkpw(password.encode('utf-8'), stored_password.encode('utf-8')):
                    return redirect('/home')
                else:
                    error_message = "Invalid username or password"
            else:
                error_message = "Invalid username or password"

    return render_template('login.html', error_message=error_message)

@app.route("/save-analysis-results", methods=["POST"])
def save_analysis_results():
    data = request.get_json()
    dumpName = data.get("dumpName")
    resultType = data.get("resultType")
    results = data.get("results")
    
    if not dumpName or not resultType or not results:
        return jsonify({"success": False, "error": "Missing required fields"}), 400
    
    output_dir = r"C:\Users\walid\Desktop\output_volatility\analysis_results"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    filename = f"{dumpName}_{resultType}_results.json"
    file_path = os.path.join(output_dir, filename)
    
    if os.path.exists(file_path):
        print(f"Overwriting existing file: {file_path}")
    
    # Save results to file
    try:
        with open(file_path, "w") as json_file:
            json.dump(results, json_file)
        return jsonify({"success": True})
    except Exception as e:
        print(f"Error saving analysis results: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/signup', methods=['GET', 'POST'])
def signup():
    error_message = None
    if request.method == 'POST':
        name = request.form['name']
        email = request.form['email']
        password = request.form['password']
        confirm_password = request.form['confirm_password']

        if password != confirm_password:
            error_message = "Passwords do not match"
        else:
            try:
                # Hash the password
                hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

                cursor = mysql.connection.cursor()
                cursor.execute(
                    "INSERT INTO users (name, email, password) VALUES (%s, %s, %s)",
                    (name, email, hashed_password)
                )
                mysql.connection.commit()
                cursor.close()

                return redirect('/login')
            except Exception as e:
                error_message = "An error occurred. Please try again."

    return render_template('signup.html', error_message=error_message)

metadata_file_path = 'C:\\Users\\walid\\Desktop\\dump_memory\\metadata.json'

@app.route('/upload_memory_dump', methods=['POST'])
def upload_memory_dump():
    if 'memoryDumpFile' not in request.files:
        return jsonify({"success": False, "message": "No file part"})
    
    file = request.files['memoryDumpFile']
    os_type = request.form.get('os', 'unknown')
    plugins = json.loads(request.form.get('plugins', '[]'))
    
    if file.filename == '':
        return jsonify({"success": False, "message": "No selected file"})
    
    try:
        dump_dir = r"C:\Users\walid\Desktop\dump_memory"
        dump_path = os.path.join(dump_dir, file.filename)
        file.save(dump_path)
        
        metadata = {
            "name": file.filename,
            "os": os_type,
            "plugins": plugins,
            "profile": None
        }
        
        if os_type.lower() == 'linux':
            if 'profileFile' not in request.files:
                return jsonify({"success": False, "message": "Profile file is required for Linux dumps"})
            profile_file = request.files['profileFile']
            symbols_dir = r"C:\Users\walid\Desktop\volatility3-develop\volatility3\symbols\linux"
            os.makedirs(symbols_dir, exist_ok=True)
            profile_name = f"{os.path.splitext(file.filename)[0]}_profile.py"
            profile_path = os.path.join(symbols_dir, profile_name)
            profile_file.save(profile_path)
            metadata["profile"] = profile_name
        else:
            metadata["profile"] = None
        
        metadata_file_path = os.path.join(dump_dir, 'metadata.json')
        metadata_list = []
        if os.path.exists(metadata_file_path):
            with open(metadata_file_path, 'r') as f:
                metadata_list = json.load(f)
        
        metadata_list.append(metadata)
        
        with open(metadata_file_path, 'w') as f:
            json.dump(metadata_list, f)
        
        for plugin in plugins:
            if os_type.lower() == 'linux':
                run_analysis(dump_path, os_type, plugin)
            else:
                run_analysis(dump_path, os_type, plugin)
        
        return jsonify({"success": True, "dumpName": file.filename})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route('/get_uploaded_dumps', methods=['GET'])
def get_uploaded_dumps():
    if os.path.exists(metadata_file_path):
        with open(metadata_file_path, 'r') as f:
            metadata_list = json.load(f)
        return jsonify({"dumps": metadata_list})
    else:
        return jsonify({"dumps": []})

DUMP_DIR = 'C:\\Users\\walid\\Desktop\\dump_memory'
ANALYSIS_RESULTS_DIR = 'C:\\Users\\walid\\Desktop\\output_volatility\\Analysis_results'
PLUGIN_RESULTS_DIR = 'C:\\Users\\walid\\Desktop\\output_volatility'
REPORTS_DIR = 'C:\\Users\\walid\\Desktop\\output_volatility\\reports'

@app.route('/delete-dump-memory/<string:dump_name>', methods=['DELETE'])
def delete_dump_memory(dump_name):
    try:
        dump_path = os.path.join(DUMP_DIR, dump_name)  
        analysis_results_pattern = os.path.join(ANALYSIS_RESULTS_DIR, f"{dump_name}_*")
        plugin_results_pattern = os.path.join(PLUGIN_RESULTS_DIR, f"{dump_name}_*")
        report_path = os.path.join(REPORTS_DIR, f"report_{dump_name}.pdf")

        # Delete the dump memory file
        if os.path.exists(dump_path):
            os.remove(dump_path)
            logging.info(f"Deleted dump memory: {dump_path}")
        else:
            logging.warning(f"Dump memory not found: {dump_path}")

        # Delete all analysis result files matching the pattern
        logging.info(f"Attempting to delete analysis results matching: {analysis_results_pattern}")
        for analysis_result_file in glob.glob(analysis_results_pattern):
            try:
                os.remove(analysis_result_file)
                logging.info(f"Deleted analysis result file: {analysis_result_file}")
            except Exception as e:
                logging.error(f"Failed to delete analysis result file {analysis_result_file}: {str(e)}")

        # Delete all plugin results files matching the pattern
        logging.info(f"Attempting to delete plugin results matching: {plugin_results_pattern}")
        for plugin_result_file in glob.glob(plugin_results_pattern):
            try:
                os.remove(plugin_result_file)
                logging.info(f"Deleted plugin result file: {plugin_result_file}")
            except Exception as e:
                logging.error(f"Failed to delete plugin result file {plugin_result_file}: {str(e)}")

        # Delete the report file
        if os.path.exists(report_path):
            os.remove(report_path)
            logging.info(f"Deleted report: {report_path}")
        else:
            logging.warning(f"Report not found: {report_path}")

        # Remove the dump memory metadata from metadata.json
        if os.path.exists(metadata_file_path):
            with open(metadata_file_path, 'r') as f:
                metadata_list = json.load(f)

            metadata_list = [metadata for metadata in metadata_list if metadata["name"] != dump_name]

            with open(metadata_file_path, 'w') as f:
                json.dump(metadata_list, f)
            logging.info(f"Updated metadata.json")
        else:
            logging.warning(f"Metadata file not found: {metadata_file_path}")

        return jsonify({"success": True})
    except Exception as e:
        logging.error(f"Error deleting dump memory: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


memory_dumps = []
@login_required 
@app.route('/volatility3', methods=['GET', 'POST'])
def volatility3():
    return render_template('volatility3.html', memory_dumps=memory_dumps)



@login_required 
@app.route('/add_memory_dump', methods=['POST'])
def add_memory_dump():
    dump_name = request.json.get('dump_name')
    if dump_name:
        memory_dumps.append(dump_name)
        return jsonify({'success': True, 'message': f'Dump "{dump_name}" ajouté !'})
    return jsonify({'success': False, 'message': 'Le nom du dump est vide !'})

if __name__ == "__main__":
    app.run(debug=True)
