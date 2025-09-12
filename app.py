import os
import json
from datetime import datetime
from pyzabbix import ZabbixAPI, ZabbixAPIException
from flask import Flask, render_template, flash
from dotenv import load_dotenv
import requests

# --- 1. IMPORTAR MÓDULOS DE LOGGING ---
import logging
from logging.handlers import RotatingFileHandler

load_dotenv()

# Desabilitar avisos de SSL
from urllib3.exceptions import InsecureRequestWarning
requests.packages.urllib3.disable_warnings(category=InsecureRequestWarning)

# --- Configuração da Aplicação Flask ---
app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'default_secret_key_change_me')

# Adicionar filtro tojson para uso em templates
app.jinja_env.filters['tojson'] = lambda obj: json.dumps(obj)

# --- 2. CONFIGURAR O LOGGER ---
# Define o formato do log para incluir data, nível, mensagem e a origem do log
formatter = logging.Formatter('%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]')

# Cria um handler que escreve os logs em um ficheiro, com rotação.
# O ficheiro 'dashboard.log' terá no máximo 1MB e manterá 1 backup.
handler = RotatingFileHandler('dashboard.log', maxBytes=1000000, backupCount=1)
handler.setFormatter(formatter)
handler.setLevel(logging.INFO) # Define o nível mínimo de log para o ficheiro

# Adiciona o handler ao logger da aplicação Flask
app.logger.addHandler(handler)
app.logger.setLevel(logging.INFO) # Define o nível mínimo de log para a aplicação

# --- Configurações do Zabbix ---
ZABBIX_SERVER = os.getenv('ZABBIX_SERVER', '')
ZABBIX_USER = os.getenv('ZABBIX_USER', '')
ZABBIX_PASSWORD = os.getenv('ZABBIX_PASSWORD', '')

# --- Funções Auxiliares (sem alterações) ---
def get_time_since_status(timestamp):
    # ... (código da função igual ao anterior) ...
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

# --- Rotas da Aplicação ---
@app.route('/')
def dashboard():
    app.logger.info("Dashboard de proxies acessado, iniciando coleta de dados.") # Log de informação
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
        # Obter apenas contagem de problemas ativos para o dashboard principal
        problemas_ativos = zapi.trigger.get(
            filter={'value': 1, 'priority': ['4', '5']},
            countOutput=True
        )
        
        # Preparar o resumo básico apenas para o status de problemas
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

@app.route('/server')
def server_metrics():
    app.logger.info("Dashboard de métricas do servidor acessado.")
    
    if not ZABBIX_SERVER:
        flash("A variável ZABBIX_SERVER não está definida no seu ficheiro .env.", "error")
        app.logger.error("A variável de ambiente ZABBIX_SERVER não foi encontrada.")
        return render_template('server.html', server_summary=None)

    try:
        session = requests.Session()
        session.verify = False
        zapi = ZabbixAPI(ZABBIX_SERVER, session=session)
        zapi.login(ZABBIX_USER, ZABBIX_PASSWORD)
    except Exception as e:
        flash(f"Erro ao conectar à API do Zabbix: {e}", "error")
        app.logger.error(f"Falha na conexão com a API do Zabbix: {e}", exc_info=True)
        return render_template('server.html', server_summary=None)

    try:
        # Obter informações básicas sobre hosts e itens
        total_hosts = zapi.host.get(countOutput=True)
        total_items = zapi.item.get(countOutput=True)
        problemas_ativos = zapi.trigger.get(
            filter={'value': 1, 'priority': ['4', '5']},
            countOutput=True
        )
        
        # Obter informações do servidor Zabbix
        server_info = zapi.apiinfo.version()  # Versão da API
        
        # Buscar estatísticas do Zabbix Server
        server_items = zapi.item.get(
            filter={"hostid": "10084", "key_": [
                "zabbix[uptime]", 
                "zabbix[process,alert manager,avg,busy]", 
                "zabbix[wcache,history,pfree]",
                "zabbix[process,db watchdog,avg,busy]",
                "zabbix[rcache,buffer,pfree]",
                "zabbix[wcache,values]",
                "zabbix[process,poller,avg,busy]",
                "zabbix[process,trapper,avg,busy]"
            ]},
            output=["name", "key_", "lastvalue", "units"]
        )
        
        # Organizar os itens em um dicionário para fácil acesso
        server_data = {}
        for item in server_items:
            key = item["key_"].replace("zabbix[", "").replace("]", "").replace(",", "_")
            value = item["lastvalue"]
            unit = item["units"]
            server_data[key] = {"value": value, "unit": unit}
        
        # Formatar o tempo de uptime para dias, horas e minutos
        uptime_seconds = int(server_data.get("uptime", {}).get("value", 0))
        days, remainder = divmod(uptime_seconds, 86400)
        hours, remainder = divmod(remainder, 3600)
        minutes, seconds = divmod(remainder, 60)
        formatted_uptime = f"{days}d {hours}h {minutes}m"
        
        # Preparar o resumo do servidor
        server_summary = {
            'total_hosts': total_hosts,
            'total_items': total_items,
            'problemas_ativos': problemas_ativos,
            'problemas_color': 'danger' if int(problemas_ativos) > 0 else 'success',
            'version': server_info,
            'uptime': formatted_uptime,
            'alert_manager_busy': f"{float(server_data.get('process_alert manager_avg_busy', {}).get('value', 0)):.1f}%",
            'history_cache_free': f"{float(server_data.get('wcache_history_pfree', {}).get('value', 0)):.1f}%",
            'db_watchdog_busy': f"{float(server_data.get('process_db watchdog_avg_busy', {}).get('value', 0)):.1f}%",
            'rcache_free': f"{float(server_data.get('rcache_buffer_pfree', {}).get('value', 0)):.1f}%",
            'values_processed': server_data.get('wcache_values', {}).get('value', 'N/A'),
            'poller_busy': f"{float(server_data.get('process_poller_avg_busy', {}).get('value', 0)):.1f}%",
            'trapper_busy': f"{float(server_data.get('process_trapper_avg_busy', {}).get('value', 0)):.1f}%"
        }
        
        zapi.user.logout()
        app.logger.info("Dados do Zabbix Server coletados com sucesso.")
    except Exception as e:
        flash(f"Erro ao buscar dados do Zabbix: {e}", "error")
        app.logger.error(f"Falha ao buscar dados do Zabbix: {e}", exc_info=True)
        return render_template('server.html', server_summary=None)
        
    formatted_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    return render_template('server.html', server_summary=server_summary, last_updated=formatted_time)

if __name__ == '__main__':
    app.logger.info("Aplicação iniciada em modo de debug.")
    app.run(debug=True, host='0.0.0.0', port=5001)