FROM python:3.11-slim

WORKDIR /app

# Instalar dependências
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar arquivos da aplicação
COPY . .

# Criar diretório de logs
RUN mkdir -p logs

# Configurar variáveis de ambiente
ENV FLASK_ENV=production
ENV PORT=5001

# Expor a porta da aplicação
EXPOSE 5001

# Iniciar a aplicação
CMD ["gunicorn", "--config", "gunicorn_config.py", "wsgi:app"]