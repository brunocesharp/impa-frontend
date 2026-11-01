# Uso: python scripts/gerar-icones.py public  (a partir da raiz do impa-frontend; requer Pillow)
"""Gera os ícones do PWA e o favicon a partir do símbolo (cometa) da marca."""
import sys
from pathlib import Path
from PIL import Image

publico = Path(sys.argv[1])
simbolo = Image.open(publico / "brand/simbolo.png").convert("RGBA")
simbolo = simbolo.crop(simbolo.getbbox())
ESPACO = (0x12, 0x13, 0x18, 255)

def icone(lado: int, ocupacao: float, fundo) -> Image.Image:
    tela = Image.new("RGBA", (lado, lado), fundo)
    escala = ocupacao * lado / max(simbolo.size)
    tam = (round(simbolo.width * escala), round(simbolo.height * escala))
    s = simbolo.resize(tam, Image.LANCZOS)
    tela.alpha_composite(s, ((lado - tam[0]) // 2, (lado - tam[1]) // 2))
    return tela

# "any": cometa grande sobre o fundo Espaço; "maskable": dentro da zona segura (círculo de 80%).
for lado in (72, 96, 128, 144, 152, 192, 384, 512):
    icone(lado, 0.74, ESPACO).convert("RGB").save(publico / f"icons/icon-{lado}x{lado}.png", optimize=True)
for lado in (192, 512):
    icone(lado, 0.56, ESPACO).convert("RGB").save(publico / f"icons/maskable-icon-{lado}x{lado}.png", optimize=True)
icone(180, 0.70, ESPACO).convert("RGB").save(publico / "icons/apple-touch-icon.png", optimize=True)

# Favicon: só o cometa, fundo transparente (aba clara ou escura).
icone(256, 0.96, (0, 0, 0, 0)).save(publico / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print("ok")
