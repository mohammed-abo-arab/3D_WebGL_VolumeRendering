from django.shortcuts import render
from django.shortcuts import render

# Create your views here.
def IndexView(request):
    return render(request, 'volapp/final3dWebGL.html')