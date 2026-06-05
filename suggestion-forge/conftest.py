import sys
import pathlib

# Allow `from models import ...`, `from classifier import ...`, etc. to resolve
# regardless of which directory pytest is invoked from. Mirrors research-engine.
sys.path.insert(0, str(pathlib.Path(__file__).parent))
