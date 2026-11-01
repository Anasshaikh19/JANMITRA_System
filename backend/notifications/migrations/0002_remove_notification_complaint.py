# Generated for JANMITRA - Nagpur Municipal Corporation Civic Issue System

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0001_initial'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='notification',
            name='complaint',
        ),
    ]
