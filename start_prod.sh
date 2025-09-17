#!/bin/bash
# start_prod.sh
# Script para iniciar a aplicação em produção no Linux/Unix

# Criar pasta de logs se não existir
mkdir -p logs

# Definir variável de ambiente para produção
export FLASK_ENV="production"

# Iniciar com Gunicorn
gunicorn --config gunicorn_config.py wsgi:app