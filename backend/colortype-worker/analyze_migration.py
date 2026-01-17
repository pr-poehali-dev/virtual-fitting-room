"""
Analyze colortype_references.json and show migration summary
Run: python analyze_migration.py
"""
import json
from collections import defaultdict

def analyze_migration():
    """Analyze what will be migrated"""
    print("=" * 80)
    print("COLORTYPE IMAGES MIGRATION ANALYSIS")
    print("=" * 80)
    
    # Load colortype references
    with open('colortype_references.json', 'r', encoding='utf-8') as f:
        refs = json.load(f)
    
    total_schemes = 0
    total_examples = 0
    colortype_stats = []
    
    print(f"\nFound {len(refs)} color types:\n")
    
    for colortype, data in refs.items():
        scheme_count = 1 if 'scheme_url' in data else 0
        example_count = len(data.get('examples', []))
        total_count = scheme_count + example_count
        
        total_schemes += scheme_count
        total_examples += example_count
        
        colortype_stats.append({
            'name': colortype,
            'scheme': scheme_count,
            'examples': example_count,
            'total': total_count
        })
        
        # Generate folder name
        folder_name = colortype.lower().replace(' ', '-')
        
        print(f"{colortype}")
        print(f"  Folder: colortype-schemes/{folder_name}/")
        print(f"  Scheme images: {scheme_count}")
        print(f"  Example images: {example_count}")
        print(f"  Total images: {total_count}")
        
        # Show what will be created
        if scheme_count:
            scheme_url = data['scheme_url']
            ext = 'jpg' if scheme_url.endswith('.jpg') else 'jpeg'
            print(f"    → scheme.{ext}")
        
        for i in range(example_count):
            example_url = data['examples'][i]
            ext = 'webp' if example_url.endswith('.webp') else 'jpg'
            print(f"    → example-{i+1}.{ext}")
        
        print()
    
    # Summary statistics
    print("=" * 80)
    print("MIGRATION SUMMARY")
    print("=" * 80)
    print(f"Total color types: {len(refs)}")
    print(f"Total scheme images: {total_schemes}")
    print(f"Total example images: {total_examples}")
    print(f"Total images to migrate: {total_schemes + total_examples}")
    
    # Sort by total images
    colortype_stats.sort(key=lambda x: x['total'], reverse=True)
    
    print("\nColor types by image count:")
    for stat in colortype_stats:
        print(f"  {stat['name']:<20} {stat['total']:>2} images ({stat['scheme']} scheme + {stat['examples']} examples)")
    
    print("\n" + "=" * 80)
    print("NEW S3 STRUCTURE PREVIEW")
    print("=" * 80)
    print("\ncolortype-schemes/")
    for stat in colortype_stats[:3]:  # Show first 3 as examples
        folder_name = stat['name'].lower().replace(' ', '-')
        print(f"├── {folder_name}/")
        print(f"│   ├── scheme.jpg")
        for i in range(stat['examples']):
            connector = "│   ├──" if i < stat['examples'] - 1 else "│   └──"
            print(f"{connector} example-{i+1}.webp")
    print("├── ...")
    print(f"└── (total: {len(refs)} folders)")
    
    print("\n" + "=" * 80)
    print("READY TO MIGRATE")
    print("=" * 80)
    print("\nTo run migration:")
    print("  1. Set environment variables:")
    print("     export S3_ACCESS_KEY='your-key'")
    print("     export S3_SECRET_KEY='your-secret'")
    print("     export S3_BUCKET_NAME='your-bucket'")
    print("\n  2. Test S3 connection:")
    print("     python test_s3_connection.py")
    print("\n  3. Run migration:")
    print("     python migrate_images.py")
    print()

if __name__ == '__main__':
    analyze_migration()
