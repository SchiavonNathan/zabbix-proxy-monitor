# start_prod.ps1
# Script para iniciar a aplicação em produção no Windows

# Criar pasta de logs se não existir
if (-not (Test-Path -Path ".\logs")) {
    New-Item -ItemType Directory -Path ".\logs"
}

# Definir variável de ambiente para produção
$env:FLASK_ENV = "production"

# Iniciar com Waitress (servidor WSGI para Windows)
# Instalar primeiro: pip install waitress
python -m waitress --port=5001 wsgi:app