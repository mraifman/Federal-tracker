import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from refresh_awards import get, observation

class IngestionTests(unittest.TestCase):
    def test_zero_is_a_verified_value(self):
        row = observation({'toptier_code': '020', 'fiscal_year': 2025, 'obligations': 0, 'transaction_count': 0}, '020', 2025)
        self.assertEqual(row['obligations'], 0)

    def test_mismatched_identity_and_nonfinite_values_rejected(self):
        for code, value in [('999', 1), ('020', float('nan')), ('020', True), ('020', None)]:
            with self.subTest(code=code, value=value), self.assertRaises(ValueError):
                observation({'toptier_code': code, 'fiscal_year': 2025, 'obligations': value, 'transaction_count': 1}, '020', 2025)

    @patch('refresh_awards.time.sleep')
    @patch('refresh_awards.urllib.request.urlopen', side_effect=TimeoutError('unavailable'))
    def test_retries_exhausted_raise_original_failure(self, request, sleep):
        with self.assertRaises(TimeoutError):
            get('/api/v2/agency/020/awards/')
        self.assertEqual(request.call_count, 3)

    @patch('refresh_awards.urllib.request.urlopen', side_effect=HTTPError('url', 400, 'Bad Request', {}, None))
    def test_invalid_request_is_not_retried(self, request):
        with self.assertRaises(HTTPError):
            get('/api/v2/agency/020/awards/')
        self.assertEqual(request.call_count, 1)

if __name__ == '__main__':
    unittest.main()
