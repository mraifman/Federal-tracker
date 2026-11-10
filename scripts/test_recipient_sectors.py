import unittest
from recipient_sectors import assistance_sector

class RecipientSectorTests(unittest.TestCase):
    def test_nonprofit_exclusion_is_not_higher_education(self):
        # Federal M/N descriptions say "OTHER THAN AN INSTITUTION OF HIGHER EDUCATION".
        for code in ['M','N','12','MX','NX']:
            with self.subTest(code=code):self.assertEqual(assistance_sector(code),'Nonprofits')

    def test_higher_education_requires_explicit_code(self):
        for code in ['H','O','S','T','U','V','06','20','HMX','HOM']:
            with self.subTest(code=code):self.assertEqual(assistance_sector(code),'Academia')

    def test_public_school_district_is_not_academia(self):
        self.assertEqual(assistance_sector('G'),'Government / public bodies')
        self.assertEqual(assistance_sector('L'),'Government / public bodies')

    def test_private_and_unknown_are_not_guessed_from_names(self):
        for code in ['Q','R','22','23']:
            self.assertEqual(assistance_sector(code),'Private sector')
        for code in [None,'','X','W','ZZ','99']:
            self.assertEqual(assistance_sector(code),'Unknown / unclassified')

    def test_individuals_are_protected_even_with_other_flags(self):
        for code in ['P','21','PRG','PAB','HP']:
            self.assertEqual(assistance_sector(code),'Individuals')

if __name__=='__main__':unittest.main()
