from django.urls import path

from . import views

app_name = 'volApp'
urlpatterns = [
    path('', views.IndexView, name='index'),

]