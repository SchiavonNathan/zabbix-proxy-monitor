import secrets
import os
from dotenv import load_dotenv, set_key
import sys

def generate_secret_key():
    """Gera uma chave secreta segura e a adiciona ao arquivo .env"""
    # Gerar chave secreta de 32 bytes (256 bits)
    key = secrets.token_hex(32)
    
    # Verificar se o arquivo .env existe
    if os.path.exists(".env"):
        # Carregar variáveis existentes
        load_dotenv()
        
        # Atualizar a variável FLASK_SECRET_KEY no arquivo .env
        with open(".env", "r") as file:
            lines = file.readlines()
        
        with open(".env", "w") as file:
            key_found = False
            for line in lines:
                if line.startswith("FLASK_SECRET_KEY="):
                    file.write(f"FLASK_SECRET_KEY={key}\n")
                    key_found = True
                else:
                    file.write(line)
            
            if not key_found:
                file.write(f"\nFLASK_SECRET_KEY={key}\n")
        
        print(f"Chave secreta gerada e adicionada ao arquivo .env: {key}")
    else:
        # Criar um novo arquivo .env com a chave secreta
        with open(".env", "w") as file:
            file.write(f"FLASK_SECRET_KEY={key}\n")
        
        print(f"Arquivo .env criado com a chave secreta: {key}")

if __name__ == "__main__":
    print("Gerando chave secreta para o Zabbix Dashboard...")
    generate_secret_key()
    print("Concluído!")