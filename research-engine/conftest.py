import sys
import pathlib

# Allow `from models import ...` and `from engine import ...` to work
# regardless of which directory pytest is invoked from.
sys.path.insert(0, str(pathlib.Path(__file__).parent))
