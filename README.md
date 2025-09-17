# Zabbix Proxy Dashboard

Dashboard para monitoramento de proxies do Zabbix.

## Configuração para Produção

### Pré-requisitos
- Python 3.9 ou superior
- Acesso a um servidor Zabbix

### Instalação

1. Clone o repositório:
```
git clone https://github.com/SchiavonNathan/zabbix-dashboards.git
cd zabbix-dashboards
```

2. Crie um ambiente virtual e ative-o:

**Windows**:
```
python -m venv venv
venv\Scripts\activate
```

**Linux/macOS**:
```
python3 -m venv venv
source venv/bin/activate
```

3. Instale as dependências:
```
pip install -r requirements.txt
```

4. Configure o arquivo `.env`:
Copie o arquivo `.envexample` para `.env` e preencha as variáveis:
```
cp .envexample .env
```
Edite o arquivo `.env` com suas credenciais do Zabbix e outras configurações.

### Execução em Produção

#### No Windows:

1. Execute o script de produção:
```
.\start_prod.ps1
```

Ou manualmente:
```
$env:FLASK_ENV = "production"
python -m waitress --port=5001 wsgi:app
```

#### No Linux/Unix:

1. Execute o script de produção:
```
chmod +x start_prod.sh
./start_prod.sh
```

Ou manualmente:
```
export FLASK_ENV="production"
gunicorn --config gunicorn_config.py wsgi:app
```

### Configuração como Serviço no Linux

1. Copie o arquivo de serviço para a pasta do systemd:
```
sudo cp zabbix-dashboard.service /etc/systemd/system/
```

2. Ajuste o caminho no arquivo de serviço para corresponder à sua instalação.

3. Inicie e habilite o serviço:
```
sudo systemctl daemon-reload
sudo systemctl start zabbix-dashboard
sudo systemctl enable zabbix-dashboard
```

### Configuração com Nginx (Proxy Reverso)

É recomendado usar o Nginx como proxy reverso na frente da aplicação.

1. Instale o Nginx:
```
sudo apt update
sudo apt install nginx
```

2. Crie um arquivo de configuração para o site:
```
sudo nano /etc/nginx/sites-available/zabbix-dashboard
```

3. Adicione a configuração:
```
server {
    listen 80;
    server_name dashboard.exemplo.com;  # Altere para seu domínio

    location / {
        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

4. Habilite o site:
```
sudo ln -s /etc/nginx/sites-available/zabbix-dashboard /etc/nginx/sites-enabled/
sudo systemctl reload nginx
```

### Configuração com IIS (Windows Server)

1. Instale o módulo URL Rewrite no IIS.

2. Crie um novo site no IIS apontando para a pasta da aplicação.

3. Configure o Reverse Proxy:
   - Na página inicial do IIS, abra URL Rewrite
   - Adicione uma nova regra de Reverse Proxy
   - Configure para encaminhar solicitações para http://localhost:5001

## Segurança

- Sempre use HTTPS em produção
- Gere uma chave secreta forte para a variável FLASK_SECRET_KEY
- Restrinja o acesso ao dashboard conforme necessário
- Considere adicionar autenticação adicional

## Atualizações

Para atualizar o dashboard:

1. Pare o serviço
2. Pull das novas alterações do repositório
3. Atualize as dependências se necessário
4. Reinicie o serviço