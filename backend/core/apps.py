from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'
    verbose_name = 'Link & Learn Core'

    def ready(self):
        # Import signals here if needed
        pass
