"""Fix indentation in api/docs-pdf/index.py"""
import os

# Find the project root
script_dir = os.path.dirname(os.path.abspath(__file__))
target = os.path.join(script_dir, 'api', 'docs-pdf', 'index.py')

if not os.path.exists(target):
    # Maybe we're already in the right place
    target = 'api/docs-pdf/index.py'

print(f'Target file: {target}')

with open(target, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: if ids_param: from 16 to 8 spaces
old1 = '                if ids_param:\n            id_list = [int(x.strip()) for x in ids_param.split(",") if x.strip().isdigit()]'
new1 = '        if ids_param:\n            id_list = [int(x.strip()) for x in ids_param.split(",") if x.strip().isdigit()]'

# Fix 2: cols = [...] from 24 to 8 spaces
old2 = '                        cols = ["id", "name", "s3_url", "rec_type", "rec_amount", "rec_date", "rec_counterparty", "created_at"]'
new2 = '        cols = ["id", "name", "s3_url", "rec_type", "rec_amount", "rec_date", "rec_counterparty", "created_at"]'

count1 = content.count(old1)
count2 = content.count(old2)
print(f'Found old1: {count1} times')
print(f'Found old2: {count2} times')

if count1 > 0:
    content = content.replace(old1, new1)
if count2 > 0:
    content = content.replace(old2, new2)

with open(target, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done!')
