# gunicorn_config.py
import multiprocessing

# Número de workers baseado no número de cores
workers = multiprocessing.cpu_count() * 2 + 1
# Vincular ao endereço localhost na porta 5001
bind = "0.0.0.0:5001"
# Nível de log
loglevel = "info"
# Arquivo de log de acesso
accesslog = "logs/gunicorn-access.log"
# Arquivo de log de erros
errorlog = "logs/gunicorn-error.log"
# Timeout para processamento de requisições (em segundos)
timeout = 30
# Keepalive timeout
keepalive = 5