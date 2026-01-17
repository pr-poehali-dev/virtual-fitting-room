import json

with open('colortype_references.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

total_schemes = 0
total_examples = 0

print("\nColortype Image Summary:\n")
print("=" * 60)

for colortype, info in data.items():
    schemes = 1 if 'scheme_url' in info else 0
    examples = len(info.get('examples', []))
    total = schemes + examples
    
    total_schemes += schemes
    total_examples += examples
    
    print(f"{colortype:<20} {schemes} scheme + {examples:>2} examples = {total:>2} total")

print("=" * 60)
print(f"{'TOTALS':<20} {total_schemes} scheme + {total_examples:>2} examples = {total_schemes + total_examples:>2} total")
print("\nTotal images to migrate:", total_schemes + total_examples)
