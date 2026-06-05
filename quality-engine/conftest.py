import sys
import pathlib

# Permite `from models import ...`, `from segmentation import ...` etc.
# independente de onde o pytest for invocado.
sys.path.insert(0, str(pathlib.Path(__file__).parent))
