#!/usr/bin/env python3
"""
Workaround pour Python 3.12+ qui n'inclut plus distutils.
Ce script crée un module distutils factice qui utilise setuptools.
"""
import sys
import os

# Créer un répertoire temporaire pour le module distutils
distutils_path = os.path.join(os.path.expanduser('~'), '.local', 'lib', 'python3.12', 'site-packages')
os.makedirs(distutils_path, exist_ok=True)

# Créer le fichier __init__.py pour distutils
distutils_init = os.path.join(distutils_path, 'distutils', '__init__.py')
os.makedirs(os.path.dirname(distutils_init), exist_ok=True)

# Contenu du module distutils qui utilise setuptools
distutils_content = '''"""
Module distutils factice utilisant setuptools pour Python 3.12+
"""
try:
    from setuptools import distutils
    from setuptools.distutils import *
except ImportError:
    # Si setuptools n'est pas disponible, créer des stubs minimaux
    class StrictVersion:
        def __init__(self, vstring):
            self.vstring = vstring
        def __str__(self):
            return self.vstring
'''

with open(distutils_init, 'w') as f:
    f.write(distutils_content)

# Créer le fichier version.py
distutils_version = os.path.join(distutils_path, 'distutils', 'version.py')
version_content = '''"""
Module version pour distutils
"""
try:
    from setuptools.distutils.version import *
except ImportError:
    class StrictVersion:
        def __init__(self, vstring):
            self.vstring = vstring
        def __str__(self):
            return self.vstring
    class LooseVersion:
        def __init__(self, vstring):
            self.vstring = vstring
        def __str__(self):
            return self.vstring
'''

with open(distutils_version, 'w') as f:
    f.write(version_content)

print(f"✅ Module distutils créé dans {distutils_path}")
print("⚠️  Note: Vous devez installer setuptools pour que cela fonctionne:")
print("   python3 -m pip install --user setuptools")


