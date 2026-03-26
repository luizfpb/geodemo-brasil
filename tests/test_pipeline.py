"""
tests/test_pipeline.py -- testa funcoes auxiliares do build.py

Roda com: python -m pytest tests/test_pipeline.py
Ou:       python -m unittest tests/test_pipeline.py
"""

import sys
import unittest
from pathlib import Path

# adicionar scripts/ ao path pra importar build
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from build import parse_float, detect_keys, _extract_age


class TestParseFloat(unittest.TestCase):
    def test_inteiro(self):
        self.assertEqual(parse_float("42"), 42.0)

    def test_decimal_br(self):
        self.assertAlmostEqual(parse_float("3,14"), 3.14)

    def test_decimal_en(self):
        self.assertAlmostEqual(parse_float("3.14"), 3.14)

    def test_com_espacos(self):
        self.assertAlmostEqual(parse_float("  1234,5  "), 1234.5)

    def test_none(self):
        self.assertIsNone(parse_float(None))

    def test_string_vazia(self):
        self.assertIsNone(parse_float(""))

    def test_texto(self):
        self.assertIsNone(parse_float("abc"))

    def test_hifen(self):
        self.assertIsNone(parse_float("-"))


class TestDetectKeys(unittest.TestCase):
    def test_header_padrao(self):
        header = {
            "D1C": "Nível Territorial (Código)",
            "D1N": "Nível Territorial",
            "D2C": "Unidade de Medida (Código)",
            "D3C": "Município (Código)",
            "D3N": "Município",
            "V": "Valor",
        }
        ck, vk = detect_keys(header)
        self.assertEqual(ck, "D3C")
        self.assertEqual(vk, "V")

    def test_header_vazio(self):
        ck, vk = detect_keys({})
        # defaults
        self.assertEqual(ck, "D3C")
        self.assertEqual(vk, "V")


class TestExtractAge(unittest.TestCase):
    def test_faixa_normal(self):
        self.assertEqual(_extract_age("5 a 9 anos"), 5)

    def test_faixa_adulta(self):
        self.assertEqual(_extract_age("30 a 34 anos"), 30)

    def test_idoso(self):
        self.assertEqual(_extract_age("80 anos ou mais"), 80)

    def test_menos_de_1(self):
        self.assertEqual(_extract_age("Menos de 1 ano"), 0)

    def test_menor_de_1(self):
        self.assertEqual(_extract_age("Menor de 1 ano"), 0)

    def test_sem_numero(self):
        self.assertIsNone(_extract_age("Total"))


if __name__ == "__main__":
    unittest.main()
