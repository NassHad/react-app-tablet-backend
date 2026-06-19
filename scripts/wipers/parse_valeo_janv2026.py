import csv
import json
import datetime
import os

CSV_PATH = os.path.join(os.path.dirname(__file__), '../liste_affectation/Database_PerfectVision_Janv2026 VALEO.csv')
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), 'wipers_database_janv2026.json')


import re

# Annotations de connecteur en fin de ref : (Y), (P+Y), (X), (C), (*,,), (*,U,), (*,A,)…
_REF_ANNOTATION = re.compile(r'\s*\([^)]+\)$')

def clean_ref(val):
    v = val.strip() if val else None
    if not v:
        return None
    return _REF_ANNOTATION.sub('', v).strip() or None


# Suffixes VALEO spécifiques à stripper (codes châssis, générations, séries…)
_MODEL_SUFFIXES = re.compile(
    r'\s*\(All\s+[Mm]odels?\)'                              # (All models)
    r'|\s*\(\d+\s+[Ss]eries\)'                              # (955 series)
    r'|\s*\([A-Z]{2,3}\d+\s+[Ss]eries\)'                   # (PO536 series)
    r'|\s*\(Typ\s+\S+\)'                                    # (Typ 8P), (Typ KL)
    r'|\s*\([A-Z]{1,3}\d+(?:\s*/\s*[A-Z]{1,3}\d+)*\)'     # (F45), (W213), (BR447), (F01/ F02)
    r'|\s*\(\d+[A-Z]+\d*\)'                                 # (8U), (8P), (8V), (8Y)
    r'|\s*\(\d+\)'                                          # (1), (2), (356)
    r'|\s*\([A-H]\)',                                       # (A), (B), ..., (H)
    re.IGNORECASE
)

# Mapping des noms de marque CSV → nom exact dans Strapi
BRAND_NAME_MAP = {
    'CITROËN':          'CITROEN',
    'DS AUTOMOBILES':   'DS',
    'AUSTIN ROVER':     'AUSTIN-ROVER',
}

# Mapping des noms de modèle CSV (Jan 2026) → nom exact dans Strapi, par marque
MODEL_NAME_MAP = {
    'ALFA ROMEO': {
        'Alfa 33':                          '33',
        'Alfa 33 Q4':                       '33',
        'Alfa 6':                           '6',
        'Alfa 75':                          '75',
        'Alfa 90':                          '90',
        'Alfa 145':                         '145',
        'Alfa 146':                         '146',
        'Alfa 147':                         '147',
        'Alfa 155 Q4':                      '155',
        'Alfa 156':                         '156',
        'Alfa 156 Sportwagon / Q4':         '156',
        'Alfa 159':                         '159',
        'Alfa 159 Sportwagon / Q4':         '159',
        'Alfa 164':                         '164',
        'Alfa GTV':                         'GTV',
    },
    'AUDI': {
        'A3 (Typ 8P)':                      'A3',
        'A3 (Typ 8V)':                      'A3',
        'A3 Sportback (Typ 8P)':            'A3 Sportback',
        'A3 Sportback (Typ 8V)':            'A3 Sportback',
        'A3 Sportback (Typ 8Y)':            'A3 Sportback',
        'A4 / S4':                          'A4',
        'A4 / RS4 Avant':                   'A4 Avant',
        'A4 / S4 / RS4 Avant':              'A4 Avant',
        'A4 Allroad Quattro':               'A4 Avant',
        'A6 / RS6 Avant':                   'A6 Avant',
        'Q3 / RSQ3 (8U)':                   'Q3 / RSQ3',
        'Q7 / SQ7':                         'Q7',
    },
    'BMW': {
        '2-Series Active Tourer':           '2-Series Active',
        '2-Series Gran Coupé':              '2-Series Gran',
        '2-Series Gran Tourer':             '2-Series Gran',
        '2-Series M2/':                     '2-Series',
        '3-Series M3':                      '3-Series',
        '3-Series M3 Touring':              '3-Series Touring',
        '3-Series M3/':                     '3-Series',
        '3-Series/':                        '3-Series',
        '4-Series M4':                      '4-Series',
        '5-Series M5':                      '5-Series',
        '5-Series M535i':                   '5-Series',
        '6-Series Gran Coupé / M6':         '6-Series / M6',
        '6-Series M635 Csi':                '6-Series / M6',
        '7-Series (F01/ F02)':              '7-Series',
        '7-Series (G11/ G12)':              '7-Series',
        '7-Series (G70/ G71)':              '7-Series',
        'X3 / iX3':                         'X3',
    },
    'CADILLAC': {
        'ATS / ATS Coupé':                  'ATS / ATS',
        'CTS / CTS Coupé':                  'CTS / CTS',
    },
    'CHEVROLET': {
        'Aveo (1)':                         'Aveo',
        'Aveo (2)':                         'Aveo',
        'Camaro (5)':                       'Camaro',
        'Camaro (6)':                       'Camaro',
        'Tracker (2)':                      'Tracker',
        'Tracker (3)':                      'Tracker',
    },
    'CHRYSLER': {
        '300 C':                            '300',
        '300 M':                            '300',
        'Voyager (2)':                      'Voyager',
        'Voyager (3)':                      'Voyager',
        'Voyager / Grand Voyager (4)':      'Voyager / Grand Voyager',
        'Voyager / Grand Voyager (5)':      'Voyager / Grand Voyager',
    },
    'CITROEN': {
        'Berlingo (2)':                     'Berlingo',
        'Berlingo / ë-Berlingo (3)':        'Berlingo / ë-Berlingo',
        'C5 Tourer / Cross Tourer':         'C5 Tourer / Cross',
        'Visa/ Visa 2':                     'Visa/ Visa',
    },
    'DACIA': {
        'Duster (1)':                       'Duster',
        'Duster (2)':                       'Duster',
        'Duster (3)':                       'Duster',
        'Logan (1)':                        'Logan',
        'Logan (2)':                        'Logan',
        'Logan (1) MCV':                    'Logan MCV',
        'Logan (2) MCV':                    'Logan MCV',
        'Logan (2) MCV / Stepway':          'Logan MCV',
        'Sandero (1) / Stepway':            'Sandero / Stepway',
        'Sandero (2) / Stepway':            'Sandero / Stepway',
        'Sandero (3) / Stepway':            'Sandero / Stepway',
    },
    'DAEWOO': {
        'Nubira (1) / (2)':                 'Nubira',
        'Nubira (3)':                       'Nubira',
        'Nubira (3) SW':                    'Nubira',
    },
    'DATSUN': {
        'on-Do (BD0)':                      'on-Do',
    },
    'DODGE': {
        'Charger (2)':                      'Charger',
    },
    'DS': {
        'DS 3':                             '3',
        'DS 3 Cabrio':                      '3',
        'DS 3 Crossback / DS 3':            '3',
        'DS 4':                             '4',
        'DS 4 / DS 4 Cross':               '4',
        'DS 4 Crossback':                   '4',
        'DS 7 Crossback / DS 7':            '7 Crossback / DS',
        'DS 9':                             '9',
    },
    'DUE': {
        'Dué 2':                            'Dué',
    },
    'FIAT': {
        '500 / Abarth (typ 312)':           '500 / Abarth',
        '500 L Living / Wagon':             '500 L Living',
        'AEgea / Egea (356)':              'AEgea / Egea',
        'AEgea / Egea / Cross (357)':      'AEgea / Egea',
        'AEgea / Egea / Cross (358)':      'AEgea / Egea',
        'Tipo (356)':                       'Tipo',
        'Tipo / Tipo Cross (357)':          'Tipo',
        'Tipo / Tipo Cross (358)':          'Tipo',
    },
    'FORD': {
        'Ecosport (1)':                     'Ecosport',
        'Ecosport (2)':                     'Ecosport',
        'Escort (3)':                       'Escort',
        'Escort (4)':                       'Escort',
        'Escort (5)':                       'Escort',
        'Escort (3) / (4) Van':             'Escort',
        'Escort (4) Clipper':               'Escort Clipper',
        'Escort (5) Clipper':               'Escort Clipper',
        'Escort (5) Van':                   'Escort',
        'Fiesta (3)':                       'Fiesta',
        'Fiesta (4)':                       'Fiesta',
        'Fiesta (5)':                       'Fiesta',
        'Fiesta (6)':                       'Fiesta',
        'Fiesta (7) / Fiesta Active':       'Fiesta / Fiesta Active',
        'Fiesta Classic':                   'Fiesta',
        'Focus (1)':                        'Focus',
        'Focus (2)':                        'Focus',
        'Focus (3)':                        'Focus',
        'Focus (4) / Focus Active':         'Focus / Focus Active',
        'Focus C-Max / C-Max (DM2)':        'Focus C-Max / C-Max',
        'Galaxy (1)':                       'Galaxy',
        'Galaxy (2)':                       'Galaxy',
        'Galaxy (3)':                       'Galaxy',
        'Mondeo (1)':                       'Mondeo',
        'Mondeo (2)':                       'Mondeo',
        'Mondeo (3)':                       'Mondeo',
        'Mondeo (4)':                       'Mondeo',
        'Mondeo (1) Clipper':               'Mondeo',
        'Mondeo (2) Clipper':               'Mondeo',
        'Mondeo (3) SW':                    'Mondeo',
        'Mondeo (4) SW':                    'Mondeo',
        'Mustang (5)':                      'Mustang',
        'Mustang (6)':                      'Mustang',
        'Mustang (7)':                      'Mustang',
        'Ranger (1) / Wildtrak':            'Ranger / Wildtrak',
        'Ranger (2) / Wildtrak / Raptor':   'Ranger / Wildtrak / Raptor',
        'Transit (2)':                      'Transit / E-Transit',
        'Transit (3) / (4) / (5)':          'Transit / E-Transit',
        'Transit (Fourgon 2T) / E-Transit': 'Transit / E-Transit',
    },
    'HYUNDAI': {
        'Kona (1)':                         'Kona',
        'Kona (2)':                         'Kona',
        'Lantra (1)':                       'Lantra',
        'Lantra (2)':                       'Lantra',
        'Santa Fe (1)':                     'Santa Fe',
        'Santa Fe (2)':                     'Santa Fe',
        'Santa Fe (3)':                     'Santa Fe',
        'Santa Fe (4)':                     'Santa Fe',
        'Santa Fe (4) Hybrid':              'Santa Fe',
        'Santa Fe (5) Plug-in':             'Santa Fe',
        'Sonata (1)':                       'Sonata',
        'Sonata (2)':                       'Sonata',
        'Sonata (3)':                       'Sonata',
        'Sonata (4)':                       'Sonata',
        'Tucson (Typ JM)':                  'Tucson',
        'Tucson (Typ NX4E)':                'Tucson',
        'Tucson (Typ TLE)':                 'Tucson',
    },
    'ISUZU': {
        'D-Max N60 F':                      'D-Max N60',
    },
    'JAGUAR': {
        'XE / XE R':                        'XE / XE',
        'XF / XF R':                        'XF / XF',
    },
    'JEEP': {
        'Cherokee (KJ)':                    'Cherokee',
        'Cherokee (KK)':                    'Cherokee',
        'Cherokee (KL)':                    'Cherokee',
        'Cherokee (XJ)':                    'Cherokee',
        'Wrangler (JK) / Unlimited':        'Wrangler / Unlimited',
        'Wrangler (JL) / Wrangler 4xe':     'Wrangler / Unlimited',
    },
    'KIA': {
        'Niro (1)':                         'Niro / Niro',
        'Niro / Niro EV (2)':               'Niro / Niro',
        'Picanto (1)':                      'Picanto',
        'Picanto (2)':                      'Picanto',
        'Picanto (3) ph1 / Ph2 2024>':      'Picanto ph1 / Ph2 2024',
        'picanto (4)':                      'Picanto ph1 / Ph2 2024',
        'Sorento (1) (typ JC)':             'Sorento',
        'Sorento (2) (typ XM)':             'Sorento',
        'Sorento (3) (typ UM)':             'Sorento',
        'Sorento (4)':                      'Sorento',
        'Soul / Soul EV':                   'Soul / Soul',
        'Soul / E-Soul':                    'Soul / Soul',
        'Sportage (1)':                     'Sportage',
        'Sportage (2)':                     'Sportage',
        'Sportage (3)':                     'Sportage',
        'Sportage (4)':                     'Sportage',
        'Sportage (5)':                     'Sportage',
    },
    'LANCIA': {
        'Y (Ipsilon)':                      'Y',
    },
    'LAND ROVER': {
        'Defender 90 / 110 (LE)':           'Defender 90 / 110',
        'Defender 90 / 110 / 130 (LE)':     'Defender 90 / 110 / 130',
        'Discovery (1)':                    'Discovery',
        'Discovery (2)':                    'Discovery',
        'Discovery (5) / SV':               'Discovery / SV',
        'Freelander (1)':                   'Freelander',
        'Freelander (2)':                   'Freelander',
        'Range Rover Evoque (1)':           'Range Rover Evoque',
        'Range Rover Evoque (2)':           'Range Rover Evoque',
    },
    'LEXUS': {
        'ES 300h (200/.../350)':            'ES 300h',
        'GS 300h/450h/GS F':               'GS 300h/450h/GS',
        'IS 200 (Altezza)':                 'IS 200',
    },
    'LINCOLN': {
        'Mark 8':                           'Mark',
    },
    'MAXUS': {
        'Deliver 9':                        'Deliver',
        'T90 / T90 EV':                    'T90 / T90',
        'eDeliver 3':                       'eDeliver',
        'eDeliver 5':                       'eDeliver',
        'eDeliver 9':                       'eDeliver',
    },
    'MAZDA': {
        'Mazda 2':                          '2',
        'Mazda 2 Hybrid':                   '2',
        'Mazda 3':                          '3',
        'Mazda 5':                          '5',
        'Mazda 6':                          '6',
    },
    'MEGA': {
        'Mega Club':                        'Club',
    },
    'MERCEDES-BENZ': {
        '190 E/ D':                         '190 E',
        '200/ 300 C/ CE (123)':             '200/ 300 C/ CE',
        '200/ 300 E/ D (123)':              '200/ 300 E',
        'AMG-GT / GT S / GT R':             'AMG-GT / GT S / GT',
        'CLA-Class (117)':                  'CLA-Class',
        'Citan / Citan Van':                'Citan / Citan',
        'Citan / Combi':                    'Citan',
        'S-Class SE/ SEL (116)':            'S-Class SE/ SEL',
        'S-Class SE/ SEL (126)':            'S-Class SE/ SEL',
        'Sprinter (903)':                   'Sprinter',
        'Sprinter (906)':                   'Sprinter',
        'X-Class (470)':                    'X-Class',
    },
    'MG': {
        'MG5 SW (EV)':                      'MG5',
        'Marvel R':                         'Marvel',
    },
    'MICROCAR': {
        'Sherpa / (Bellier Docker)':        'Sherpa',
    },
    'MINAUTO': {
        '400 / City (Aixam)':               '400 / City',
    },
    'MINI': {
        'Mini Clubman (1)':                 'Clubman',
        'Mini Clubman (2)':                 'Clubman',
        'Mini Clubvan (1)':                 'Clubman',
        'Mini Countryman / All 4 (1)':      'Countryman',
        'Mini Countryman / All 4 (2)':      'Countryman',
        'Mini Countryman / Electric (3)':   'Countryman',
        'Mini EV (Electric Version)':       'EV',
        'Mini One/ Cooper/ Cooper S':       'One/ Cooper/ Cooper',
        'Mini Cooper/ Cooper S':            'One/ Cooper/ Cooper',
        'Mini Cooper C / S / JCW':          'One/ Cooper/ Cooper',
        'Mini Paceman':                     'Paceman',
        'One/ Cooper/ Cooper S':            'One/ Cooper/ Cooper',
        'Mini (Thermal version)':           'Mini',
    },
    'MITSUBISHI': {
        'ASX (1)':                          'ASX',
        'ASX (2)':                          'ASX',
        'Colt (3)':                         'Colt',
        'Colt (4)':                         'Colt',
        'Colt (5)':                         'Colt',
        'Colt (6) / CZ3/ CZT/ CZC':        'Colt / CZ3/ CZT/ CZC',
        'Colt (6) / Ralliart':              'Colt / Ralliart',
        'Colt HEV (7)':                     'Colt HEV',
        'Lancer / Evolution X':             'Lancer / Evolution',
        'Lancer Evolution 8 / 9':           'Lancer Evolution 8',
        'Pajero (2)':                       'Pajero',
        'Pajero (3) / Grand Pajero':        'Pajero',
        'Pajero (4)':                       'Pajero',
        'Shogun (2)':                       'Shogun',
        'Space Gear':                       'Space',
        'Space Runner':                     'Space',
        'Space Star / Mirage':              'Space Star',
        'Space Wagon':                      'Space',
    },
    'NISSAN': {
        '350 Z':                            '350',
        '350 Z Roadster':                   '350',
        'Bluebird Coupe (910)':             'Bluebird Coupe',
        'Fairlady Z':                       'Fairlady',
        'Juke (1)':                         'Juke',
        'Juke (2)':                         'Juke',
        'Leaf (1)':                         'Leaf',
        'Leaf (2) / Leaf 2.Zero':           'Leaf',
        'Note (1)':                         'Note',
        'Note (2)':                         'Note',
        'Qashqai (1)':                      'Qashqai',
        'Qashqai (2)':                      'Qashqai',
        'Qashqai (3)':                      'Qashqai',
        'Terrano (1)':                      'Terrano',
        'Terrano (2)':                      'Terrano',
        'Terrano (3)':                      'Terrano',
        'Tiida (1)':                        'Tiida',
        'Tiida (2)':                        'Tiida',
        'Ebro Furgon F/ E':                 'Ebro Furgon F',
        'Townstar / Townstar Combi':        'Townstar / Townstar',
        'X-Trail (1)':                      'X-Trail',
        'X-Trail (2)':                      'X-Trail',
        'X-Trail (3)':                      'X-Trail',
        'X-Trail (4)':                      'X-Trail',
    },
    'OPEL': {
        'Agila A':                          'Agila',
        'Agila B':                          'Agila',
        'Ascona (A)':                       'Ascona',
        'Ascona (B)':                       'Ascona',
        'Ascona (C)':                       'Ascona',
        'Astra (F)':                        'Astra',
        'Astra (G)':                        'Astra',
        'Astra (H)':                        'Astra',
        'Astra (H) Classic':                'Astra',
        'Astra (H) Delvan':                 'Astra',
        'Astra (H) GTC':                    'Astra GTC',
        'Astra (H) Twin Top':               'Astra Twin Top',
        'Astra (J)':                        'Astra',
        'Astra (J) GTC':                    'Astra GTC',
        'Astra (J) Sports Tourer':          'Astra',
        'Astra (K)':                        'Astra',
        'Astra (K) Sports Tourer':          'Astra',
        'Astra (L)':                        'Astra',
        'Astra (L) Sports Tourer':          'Astra',
        'Combo (A)':                        'Combo',
        'Combo (B)':                        'Combo',
        'Combo (D) / Combo Tour':           'Combo / Combo Tour',
        'Combo Life (C) / Combo / Combo-e Cargo': 'Combo',
        'Corsa (A)':                        'Corsa',
        'Corsa (B)':                        'Corsa',
        'Corsa (C)':                        'Corsa',
        'Corsa (D)':                        'Corsa',
        'Corsa (E)':                        'Corsa',
        'Corsa (F)':                        'Corsa',
        'Corsa Van':                        'Corsa',
        'Grandland / X (A)':                'Grandland',
        'Grandland X (A)':                  'Grandland',
        'Grandland (B)':                    'Grandland',
        'Insignia (A)':                     'Insignia',
        'Insignia (A) Sports Tourer':       'Insignia Sports',
        'Insignia (B) Country Tourer':      'Insignia Country',
        'Insignia (B) Grand Sport':         'Insignia Grand Sport',
        'Insignia (B) Sports Tourer':       'Insignia Sports',
        'Karl (A) / Karl Rocks (A)':        'Karl / Karl Rocks',
        'Meriva (A)':                       'Meriva',
        'Meriva (B)':                       'Meriva',
        'Mokka (A) / Mokka X (A)':          'Mokka / Mokka',
        'Mokka (B) / Mokka-e (B)':          'Mokka / Mokka',
        'Monterey 1':                       'Monterey',
        'Monterey 1/ -2':                   'Monterey',
        'Movano B':                         'Movano',
        'Omega (A)':                        'Omega',
        'Omega (B)':                        'Omega',
        'Vivaro (A)':                       'Vivaro',
        'Vivaro (B)':                       'Vivaro',
        'Vivaro (C) / Vivaro-e':            'Vivaro / Vivaro-e',
        'Zafira (A)':                       'Zafira',
        'Zafira (B)':                       'Zafira',
        'Zafira (C) / Zafira Tourer':       'Zafira / Zafira',
        'Zafira Life (D) / Zafira-e Life':  'Zafira / Zafira',
    },
    'PEUGEOT': {
        '208 (1)':                          '208',
        '208 / e-208 (2)':                  '208',
        '3008 / 3008 Hybrid (2)':           '3008 / 3008',
        '3008 / Hybrid 4 (1)':             '3008 / Hybrid',
        '308 (1)':                          '308',
        '308 (2)':                          '308',
        '308 CC (1)':                       '308 CC',
        '508 (1)':                          '508',
        '508 (2)':                          '508',
        '508 SW / RXH (1)':               '508 SW / RXH',
        'Partner (1) / Partner Origin':     'Partner / Partner Origin',
    },
    'POLESTAR': {
        'Polestar 2':                       '2',
    },
    'PORSCHE': {
        'Boxster (986 series)':             'Boxster',
        'Boxster (987 series)':             'Boxster',
        'Cayenne (1) (955 series)':         'Cayenne',
        'Cayenne (1) (957 series)':         'Cayenne',
        'Cayenne (2) (958 series)':         'Cayenne',
        'Cayenne (3) (PO536 series)':       'Cayenne',
        'Cayenne (3) Coupé':                'Cayenne',
        'Macan (95b series)':               'Macan',
        'Macan Electric (95c series)':      'Macan',
        'Panamera S / 4S / Turbo (971 series)':   'Panamera S / 4S',
        'Panamera V6 / S / 4S / Turbo (970 series)': 'Panamera S / 4S',
        'Panamera Sport Turismo (971 series)':    'Panamera Sport Turismo',
    },
    'RENAULT': {
        'Arkana (Europe) / E-Tech':         'Arkana',
        'Austral (1) / Austral E-Tech':     'Austral / Austral',
        'Captur (1)':                       'Captur',
        'Captur (2) / Captur E-Tech':       'Captur / Captur',
        'Clio (1)':                         'Clio',
        'Clio (2) / Clio (2) Campus':       'Clio / Clio Campus',
        'Clio (2) Campus':                  'Clio Campus',
        'Clio (2) RS 2.0 / Clio Sport':     'Clio',
        'Clio (3) / Clio (3) collection':   'Clio / Clio collection',
        'Clio (3) Estate':                  'Clio',
        'Clio (4)':                         'Clio',
        'Clio (4) Estate':                  'Clio',
        'Clio (5) / Clio E-Tech':           'Clio / Clio',
        'Espace (1)':                       'Espace',
        'Espace (2)':                       'Espace',
        'Espace (3)':                       'Espace',
        'Espace (4)':                       'Espace / Espace',
        'Espace (5)':                       'Espace / Espace',
        'Espace (6) / Espace E-Tech':       'Espace / Espace',
        'Express / Express Van':            'Express',
        'Kadjar (1)':                       'Kadjar',
        'Kangoo (1)':                       'Kangoo',
        'Kangoo (1) Express':               'Kangoo',
        'Kangoo (2)':                       'Kangoo / Kangoo Van',
        'Kangoo (2) Be Bop':                'Kangoo / Kangoo Van',
        'Kangoo (2) Express / Compact':     'Kangoo / Kangoo Van',
        'Kangoo (3) / Kangoo Van / E-Tech': 'Kangoo / Kangoo Van',
        'Koleos (1)':                       'Koleos',
        'Koleos (2)':                       'Koleos',
        'Laguna (1)':                       'Laguna',
        'Laguna (1) Nevada':                'Laguna',
        'Laguna (2)':                       'Laguna',
        'Laguna (2) Estate':                'Laguna',
        'Laguna (3)':                       'Laguna',
        'Laguna (3) Coupe':                 'Laguna',
        'Laguna (3) Estate':                'Laguna',
        'Master (1)':                       'Master',
        'Master (3) / Master E-Tech':       'Master / Master',
        'Master (4) / Master E-Tech':       'Master / Master',
        'Megane (1)':                       'Megane',
        'Megane (1) Classic':               'Megane',
        'Megane (1) Coupé/ Coach':          'Megane',
        'Megane (2)':                       'Megane',
        'Megane (2) Coupé-Cabriolet':       'Megane',
        'Megane (3)':                       'Megane',
        'Megane (3) CC':                    'Megane',
        'Megane (3) Coupé / RS':            'Megane',
        'Megane (3) Estate':                'Megane',
        'Megane (4)':                       'Megane',
        'Megane (4) Estate':                'Megane',
        'Megane E-Tech (5)':                'Megane',
        'Megane Scenic (1)':                'Megane Scenic',
        'Megane Scenic (1) RX4':            'Megane Scenic',
        'R 5':                              'R',
        'R 5 E-Tech':                       'R',
        'R 9':                              'R',
        'Scenic (2)':                       'Scenic',
        'Scenic (3)':                       'Scenic',
        'Scenic (3) XMOD':                  'Scenic',
        'Scenic (4) (court)':               'Scenic',
        'Scenic E-Tech (5)':                'Scenic',
        'Symbol (1) / Thalia (Clio)':       'Symbol / Thalia',
        'Twingo (1)':                       'Twingo',
        'Twingo (2)':                       'Twingo',
        'Twingo (3)':                       'Twingo',
        'Twingo (3) / Twingo E-Tech':       'Twingo',
        'Zoé / Zoé E-Tech':                 'Zoé / Zoé',
    },
    'ROVER': {
        'Rover 25':                         '25',
        'Rover 45':                         '45',
        'Rover 75':                         '75',
        'Rover 75 Tourer':                  '75',
    },
    'SAAB': {
        '9.3 Sport Combi':                  '9.3 Sport',
        '9.4 X':                            '9.4',
    },
    'SEAT': {
        'Alhambra (1)':                     'Alhambra',
        'Alhambra (2)':                     'Alhambra',
        'Cordoba (1) / (2)':                'Cordoba',
        'Cordoba (2) Vario':                'Cordoba',
        'Cordoba (3)':                      'Cordoba',
        'Cordoba (3) Vario':                'Cordoba',
        'Cordoba (4)':                      'Cordoba',
        'Cordoba (5)':                      'Cordoba',
        'Ibiza (1)':                        'Ibiza',
        'Ibiza (2)':                        'Ibiza',
        'Ibiza (3)':                        'Ibiza',
        'Ibiza (5)':                        'Ibiza',
        'Ibiza / Ibiza SC (4)':             'Ibiza / Ibiza SC',
        'Ibiza Collector (3)':              'Ibiza',
        'Ibiza ST (4)':                     'Ibiza',
        'Leon (1)':                         'Leon',
        'Leon (2)':                         'Leon',
        'Leon (3)':                         'Leon',
        'Leon (3) SC':                      'Leon',
        'Leon (3) ST':                      'Leon',
        'Leon (3) ST X-Perience':           'Leon',
        'Leon (4) (Typ KL)':                'Leon',
        'Leon (4) ST (Typ KL)':             'Leon',
        'Toledo (1)':                       'Toledo',
        'Toledo (2)':                       'Toledo',
        'Toledo (4)':                       'Toledo',
    },
    'SERES': {
        'Seres 3':                          '3',
        'Seres 7':                          '7',
    },
    'SKODA': {
        'Fabia (1)':                        'Fabia',
        'Fabia (1) Combi':                  'Fabia',
        'Fabia (1) Sedan':                  'Fabia',
        'Fabia (2)':                        'Fabia',
        'Fabia (2) Combi / Scout':          'Fabia Combi / Scout',
        'Fabia (3)':                        'Fabia',
        'Fabia (3) Combi':                  'Fabia Combi / Scout',
        'Fabia (4)':                        'Fabia',
        'Felicia (6U1)':                    'Felicia',
        'Felicia Combi (6U5)':              'Felicia',
        'Felicia Cube Van (6U5)':           'Felicia',
        'Felicia Fun (6UF, 6U7)':           'Felicia Fun',
        'Kodiaq (1)':                       'Kodiaq',
        'Kodiaq (2)':                       'Kodiaq',
        'Octavia (1)':                      'Octavia',
        'Octavia (1) Combi':                'Octavia',
        'Octavia (2)':                      'Octavia',
        'Octavia (2) Combi / Scout':        'Octavia Combi / Scout',
        'Octavia (3)':                      'Octavia',
        'Octavia (3) Combi / Scout':        'Octavia Combi / Scout',
        'Octavia (4)':                      'Octavia',
        'Octavia (4) Combi / Scout':        'Octavia Combi / Scout',
        'Pick-up (6UF / 6U7)':              'Pick-up',
        'Pick-up (787)':                    'Pick-up',
        'Superb (1)':                       'Superb',
        'Superb (2)':                       'Superb',
        'Superb (2) Combi':                 'Superb',
        'Superb (3)':                       'Superb',
        'Superb (3) Combi':                 'Superb',
        'Superb (4)':                       'Superb',
        'Superb (4) Combi':                 'Superb',
    },
    'SMART': {
        '#3':                               '3',
    },
    'SUBARU': {
        'Forester (1)':                     'Forester',
        'Forester (2)':                     'Forester',
        'Forester (3)':                     'Forester',
        'Forester (4)':                     'Forester',
        'Legacy (1)':                       'Legacy',
        'Legacy (2)':                       'Legacy',
        'Legacy (3)':                       'Legacy',
        'Legacy (4)':                       'Legacy',
        'Legacy (4) / Outback (3)':         'Legacy',
        'Legacy (5)':                       'Legacy',
        'Legacy (5) / Outback (4)':         'Legacy',
        'Legacy Outback (1)':               'Legacy',
    },
    'SUZUKI': {
        'Grand Vitara (1) /  XL7':          'Grand Vitara / XL7',
        'Grand Vitara (2) / (3)':           'Grand Vitara / XL7',
        'Vitara (1)':                       'Vitara',
        'Vitara (2)':                       'Vitara',
        'Vitara (4) / Vitara S':            'Vitara / Vitara',
        'Wagon R+':                         'Wagon R',
    },
    'TESLA': {
        'Model 3':                          'Model',
        'Model S (ph1 & ph2)':              'Model',
        'Model S (ph3)':                    'Model',
        'Model X (ph2)':                    'Model',
        'Model Y':                          'Model',
    },
    'TOYOTA': {
        'Auris (1)':                        'Auris',
        'Auris (2)':                        'Auris',
        'Auris (2) Touring Sports':         'Auris',
        'C-HR (2)':                         'C-HR',
        'Corolla / Corolla X (E140 / E150)':'Corolla / Corolla',
        'Corolla Verso 1':                  'Corolla Verso',
        'Corolla Verso 2':                  'Corolla Verso',
        'Land-Cruiser 150 (KD,GR)':         'Land-Cruiser 150',
        'Land-Cruiser SW V8 (HDJ200)':      'Land-Cruiser SW V8',
        'Mirai (2)':                        'Mirai',
        'Prius (1)':                        'Prius',
        'Prius (2)':                        'Prius',
        'Prius (3)':                        'Prius',
        'Prius (5) Plug in Hybrid / PHEV':  'Prius Plug in Hybrid',
        'Proace (1)':                       'Proace',
        'Proace (2) / Proace Verso':        'Proace / Proace Verso',
        'Proace City / City Verso (Typ E)': 'Proace City / City Verso',
        'Rav 4':                            'Rav',
        'Rav 4 Funcruiser':                 'Rav',
        'Yaris (1) (Made in France)':       'Yaris',
        'Yaris (1) (Made in Japan)':        'Yaris',
        'Yaris (2)':                        'Yaris',
        'Yaris (4) / GR Yaris':             'Yaris',
    },
    'UAZ': {
        '2206 / 31512 /':                   '2206 / 31512',
    },
    'VINFAST': {
        'VF 8':                             'VF',
    },
    'VOLKSWAGEN': {
        'Amarok (1)':                       'Amarok',
        'Amarok (2)':                       'Amarok',
        'Beetle (2) / New Beetle (2)':      'Beetle / New Beetle',
        'Caddy (1)':                        'Caddy',
        'Caddy (2)':                        'Caddy',
        'Caddy (2) Pick-Up':                'Caddy Pick-Up',
        'Crafter (1)':                      'Crafter',
        'Crafter (2)':                      'Crafter',
        'Golf (1)':                         'Golf',
        'Golf (2) C/ CL/ GL':               'Golf',
        'Golf (2) GT/ GTD/ GTI/ GLX':       'Golf GT/ GTD/ GTI/ GLX',
        'Golf (3)':                         'Golf',
        'Golf (4)':                         'Golf',
        'Golf (5)':                         'Golf',
        'Golf (5) GT':                      'Golf GT/ GTD/ GTI/ GLX',
        'Golf (5) SW':                      'Golf',
        'Golf (6)':                         'Golf',
        'Golf (6) SW':                      'Golf',
        'Golf (7)':                         'Golf',
        'Golf (7) Alltrack':                'Golf',
        'Golf (7) GTI / GTD / GTE / R / e-Golf': 'Golf GT/ GTD/ GTI/ GLX',
        'Golf (7) Variant / SW':            'Golf',
        'Golf (8)':                         'Golf',
        'Golf (8) Variant / SW':            'Golf',
        'ID.3 / ID.3 GTX (Typ E1)':         'ID.3 / ID.3 GTX',
        'Jetta':                            'Jetta / GT/ TD',
        'Jetta (1) / (2)':                  'Jetta / GT/ TD',
        'Jetta (1) / (2) GT/ TD':           'Jetta / GT/ TD',
        'Passat (1)':                       'Passat',
        'Passat (1) Variant':               'Passat Variant',
        'Passat (2)':                       'Passat',
        'Passat (2) Variant':               'Passat Variant',
        'Passat (3) / (4)':                 'Passat',
        'Passat (3) / (4) Variant':         'Passat Variant',
        'Passat (5)':                       'Passat',
        'Passat (5)  W8':                   'Passat',
        'Passat (5) Variant':               'Passat Variant',
        'Passat (6)':                       'Passat',
        'Passat (6) Variant/ SW':           'Passat SW / Variant',
        'Passat (7)':                       'Passat',
        'Passat (7) Alltrack':              'Passat Alltrack',
        'Passat (7) Variant / SW':          'Passat Variant',
        'Passat (8)':                       'Passat',
        'Passat (8) Alltrack':              'Passat Alltrack',
        'Passat (8) Variant/ SW':           'Passat Variant',
        'Passat (9) SW / Variant':          'Passat SW / Variant',
        'Polo (1)':                         'Polo',
        'Polo (2)':                         'Polo',
        'Polo (3)':                         'Polo',
        'Polo (3) Flight/ Classic':         'Polo',
        'Polo (3) Variant':                 'Polo',
        'Polo (4)':                         'Polo',
        'Polo (5) / Cross Polo':            'Polo / Cross Polo',
        'Polo (5) TDI /GTI Limited Edition':'Polo',
        'Polo (6) / Cross Polo':            'Polo / Cross Polo',
        'Polo (7)':                         'Polo',
        'Sharan (1)':                       'Sharan',
        'Sharan (2)':                       'Sharan',
        'Tiguan (1)':                       'Tiguan',
        'Tiguan (2)':                       'Tiguan',
        'Tiguan (3)':                       'Tiguan',
        'Touareg (1)':                      'Touareg',
        'Touareg (2)':                      'Touareg',
        'Touareg (3)':                      'Touareg',
        'Touran (1)':                       'Touran',
        'Touran (1) / CrossTouran (1)':     'Touran',
        'Touran (2) / CrossTouran (2)':     'Touran',
        'Touran (3)':                       'Touran',
    },
    'VOLVO': {
        'C30 (1)':                          'C30',
        'C30 E (environnemental)':          'C30',
        'C40 (1)':                          'C40',
        'C70 (1)':                          'C70',
        'C70 (2)':                          'C70',
        'S40 (1)':                          'S40',
        'S40 (2)':                          'S40',
        'S60 (1)':                          'S60',
        'S60 (2)':                          'S60',
        'V50 (1)':                          'V50',
        'XC60 (1)':                         'XC60',
        'XC60 (2)':                         'XC60',
        'XC90 (1)':                         'XC90',
        'XC90 (2)':                         'XC90',
    },
    'XEV': {
        'Yoyo EV':                          'Yoyo',
    },
}


def _clean(s: str) -> str:
    s = _MODEL_SUFFIXES.sub('', s)
    s = re.sub(r'\s+', ' ', s)        # collapse multiple spaces
    s = re.sub(r'(\s*/\s*)+$', '', s)  # strip trailing slash(es)
    return s.strip()

def normalize_model(name: str, brand: str = '') -> str:
    name = name.strip()
    brand_map = MODEL_NAME_MAP.get(brand, {})
    # 1. Exact lookup on raw name (handles prefix renames like 'Alfa 147' → '147')
    if name in brand_map:
        return brand_map[name]
    # 2. Strip generic VALEO suffixes then retry lookup
    cleaned = _clean(name)
    if cleaned in brand_map:
        return brand_map[cleaned]
    return cleaned

def normalize_brand(name: str) -> str:
    return BRAND_NAME_MAP.get(name.strip(), name.strip())


brands = {}
total = 0

with open(CSV_PATH, encoding='utf-8') as f:
    reader = csv.reader(f)
    rows = list(reader)

# Row 0-2 are headers; data starts at index 3
for row in rows[3:]:
    if len(row) < 18:
        continue

    wipers = {
        "multiconnexion": {
            "kitAvant":       clean_ref(row[10]),
            "coteConducteur": clean_ref(row[11]),
            "monoBalais":     clean_ref(row[12]),
            "cotePassager":   clean_ref(row[13]),
        },
        "standard": {
            "coteConducteur": clean_ref(row[14]),
            "monoBalais":     clean_ref(row[15]),
            "cotePassager":   clean_ref(row[16]),
        },
        "arriere": clean_ref(row[17]),
    }

    has_wipers = any([
        wipers["multiconnexion"]["kitAvant"],
        wipers["multiconnexion"]["coteConducteur"],
        wipers["multiconnexion"]["monoBalais"],
        wipers["multiconnexion"]["cotePassager"],
        wipers["standard"]["coteConducteur"],
        wipers["standard"]["monoBalais"],
        wipers["standard"]["cotePassager"],
        wipers["arriere"],
    ])
    if not has_wipers:
        continue

    brand = normalize_brand(row[1])
    month_start = row[6].strip()
    year_start  = row[7].strip()
    month_end   = row[8].strip()
    year_end    = row[9].strip()

    start = f"{month_start}/{year_start}" if year_start else None
    end   = f"{month_end}/{year_end}"     if year_end   else None

    entry = {
        "id":        row[0].strip(),
        "model":     normalize_model(row[2], brand),
        "picto1":    row[3].strip(),
        "picto2":    row[4].strip(),
        "direction": row[5].strip(),
        "productionYears": {"start": start, "end": end},
        "wipers": wipers,
    }

    brands.setdefault(brand, []).append(entry)
    total += 1

output = {
    "metadata": {
        "source":        "Database_PerfectVision_Janv2026 VALEO.csv",
        "totalVehicles": total,
        "brands":        len(brands),
        "wiperBrand":    "Valeo",
        "generatedAt":   datetime.datetime.utcnow().isoformat() + "Z",
        "categories": {
            "multiconnexion": "Balais plat avant multiconnexion (colonnes 11-14)",
            "standard":       "Balais avant standard (colonnes 15-17)",
            "arriere":        "Arrière (colonne 18)",
        },
    },
    "brands": brands,
}

with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

# Statistics
multi_count = sum(
    1 for brand_list in brands.values() for e in brand_list
    if any(e["wipers"]["multiconnexion"].values())
)
std_count = sum(
    1 for brand_list in brands.values() for e in brand_list
    if any(e["wipers"]["standard"].values())
)
rear_count = sum(
    1 for brand_list in brands.values() for e in brand_list
    if e["wipers"]["arriere"]
)

print(f"✅ {total} véhicules / {len(brands)} marques → {OUTPUT_PATH}")
print(f"   Avec balais multiconnexion : {multi_count}")
print(f"   Avec balais standard       : {std_count}")
print(f"   Avec balai arrière         : {rear_count}")
