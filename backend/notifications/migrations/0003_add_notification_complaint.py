# Generated for JANMITRA - Nagpur Municipal Corporation Civic Issue System

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0002_remove_notification_complaint'),
        ('complaints', '0003_complaint_system'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='complaint',
            field=models.ForeignKey(
                blank=True,
                help_text='Associated complaint reference if applicable',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='notifications',
                to='complaints.complaint'
            ),
        ),
    ]
