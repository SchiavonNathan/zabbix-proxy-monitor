import os
import json
from datetime import datetime
from pyzabbix import ZabbixAPI, ZabbixAPIException
from flask import Flask, render_template, flash
from dotenv import load_dotenv
import requests

import logging
from logging.handlers import RotatingFileHandler

load_dotenv()

from urllib3.exceptions import InsecureRequestWarning
requests.packages.urllib3.disable_warnings(category=InsecureRequestWarning)

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'default_secret_key_change_me')

app.jinja_env.filters['tojson'] = lambda obj: json.dumps(obj)


formatter = logging.Formatter('%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]')


handler = RotatingFileHandler('dashboard.log', maxBytes=1000000, backupCount=1)
handler.setFormatter(formatter)
handler.setLevel(logging.INFO)

app.logger.addHandler(handler)
app.logger.setLevel(logging.INFO) 

# --- Configurações do Zabbix ---
ZABBIX_SERVER = os.getenv('ZABBIX_SERVER', '')
ZABBIX_USER = os.getenv('ZABBIX_USER', '')
ZABBIX_PASSWORD = os.getenv('ZABBIX_PASSWORD', '')


def get_time_since_status(timestamp):
    if int(timestamp) == 0:
        return "Nunca", "danger"
    now = datetime.now()
    last_access = datetime.fromtimestamp(int(timestamp))
    delta = now - last_access
    if delta.days > 0:
        return f"{delta.days}d atrás", "danger"
    elif delta.seconds > 3600:
        return f"{delta.seconds // 3600}h atrás", "warning"
    elif delta.seconds > 300:
        return f"{delta.seconds // 60}m atrás", "warning"
    else:
        return "Agora", "success"

@app.route('/')
def dashboard():
    app.logger.info("Dashboard de proxies acessado, iniciando coleta de dados.")
    if not ZABBIX_SERVER:
        flash("A variável ZABBIX_SERVER não está definida no seu ficheiro .env.", "error")
        app.logger.error("A variável de ambiente ZABBIX_SERVER não foi encontrada.")
        return render_template('index.html', server_summary=None, proxies=None)

    try:
        session = requests.Session()
        session.verify = False
        zapi = ZabbixAPI(ZABBIX_SERVER, session=session)
        zapi.login(ZABBIX_USER, ZABBIX_PASSWORD)
    except Exception as e:
        flash(f"Erro ao conectar à API do Zabbix: {e}", "error")
        app.logger.error(f"Falha na conexão com a API do Zabbix: {e}", exc_info=True)
        return render_template('index.html', server_summary=None, proxies=None)

    try:
        problemas_ativos = zapi.trigger.get(
            filter={'value': 1, 'priority': ['4', '5']},
            countOutput=True
        )
        
        server_summary = {
            'problemas_ativos': problemas_ativos,
            'problemas_color': 'danger' if int(problemas_ativos) > 0 else 'success'
        }
        proxy_data = zapi.proxy.get(
            output=['host', 'status', 'lastaccess'],
            selectHosts=['hostid']
        )
        proxies_list = []
        for p in sorted(proxy_data, key=lambda item: item['host']):
            last_access_text, color_class = get_time_since_status(p['lastaccess'])
            proxies_list.append({
                'name': p['host'], 'mode': "Ativo" if p['status'] == '5' else "Passivo",
                'last_access': last_access_text, 'hosts_count': len(p['hosts']),
                'status_color': color_class
            })
        proxies_not_now = [
            proxy for proxy in proxies_list if proxy['last_access'] != "Agora"
        ]
        zapi.user.logout()
        app.logger.info("Dados do Zabbix coletados com sucesso.")
    except Exception as e:
        flash(f"Erro ao buscar dados do Zabbix: {e}", "error")
        app.logger.error(f"Falha ao buscar dados do Zabbix: {e}", exc_info=True)
        return render_template('index.html', server_summary=None, proxies=None)

    formatted_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    return render_template('index.html', 
                           server_summary=server_summary, 
                           proxies=proxies_list, 
                           proxies_not_now=proxies_not_now, 
                           last_updated=formatted_time)


if __name__ == '__main__':
    app.logger.info("Aplicação iniciada em modo de debug.")
    app.run(debug=True, host='0.0.0.0', port=5001)