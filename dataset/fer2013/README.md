# DataTrainX FER2013 

[![GitHub release](https://img.shields.io/static/v1?label=Release&message=v1.0-alpha&color=blue)](https://github.com/gitshanks/fer2013/releases)
[![PyPI pyversions](https://img.shields.io/static/v1?label=Python&message=3.6&color=green)](https://pypi.python.org/pypi/ansicolortags/)

Reconnaissance des émotions faciales sur l'ensemble de données FER2013 à l'aide d'un réseau neuronal convolutif (CNN).

Ratio 80-10-10 pour les ensembles d'entraînement-validation-test.

Gagnant - 71 % de précision
Ce modèle - 65 % de précision

![emotions](https://user-images.githubusercontent.com/3437490/160833721-3ded7d22-458b-426c-866a-949e09cfa0cf.png)


## Commencer

Ces instructions permettront à ce modèle d'être opérationnel. Suivez-les pour utiliser le fichier `train.py` afin de reconnaître les émotions faciales à l'aide d'images personnalisées. Ce modèle peut également être utilisé dans le cadre de projets de reconnaissance des émotions faciales avec des applications plus larges

### Bibliothèques

```
 pip install tensorflow 2.1, Tensorflow-gpu 2.1 
 pip install keras 2.3.1
 pip install numpy 1.19
 pip install pandas
 pip install sklearn (Matrice de confusion)
```


### Utilisation : Construire à partir de zéro
Clone ce dépot en utilisant :
```
git clone https://github.com/davy-blavette/DatatrainX/tree/main/dataset/fer2013
```
Téléchargez et extrayez l'ensemble de données à partir du lien Kaggle ci-dessous.
Kaggle Challenge - https://www.kaggle.com/c/challenges-in-representation-learning-facial-expression-recognition-challenge/data

## Fonction preprocessing() :

Exécutez le fichier `train.py`, qui générera les fichiers `fadataX.npy` et `flabels.npy` pour vous dans le dossier preprocessing.

## Fonction train() :

Exécutez le fichier `train.py`, cela prendrait un certain temps en fonction de votre processeur et de votre gpu. A pris environ 40 minutes avec un processeur Intel Core i7-4790 3,60 GHz et un GPU Nvidia GeForce RTX 2060 6 Go, avec tensorflow fonctionnant sur le support GPU. Cela créerait les fichiers `modXtest.npy`, `modytest,npy`, `fer.json` et `fer.h5` pour vous, dans les dossiers respectifs accuracy et weights.

## Fonction accuracy() :

Vous pouvez tester la précision du classificateur formé à l'aide de `modXtest.npy` et `modytest.npy` en exécutant le fichier `fertest.py`. Cela vous donnerait la précision en % du classificateur récemment formé.

## Fonction matrix() :

Vous pouvez obtenir la matrice de confusion pour ce modèle en exécutant la fonction matrix(), ce qui génére une un fichier `fer_best.png` pour votre modèle entraîné, qui ressemblerait à ceci.

![confusionmatrix](https://github.com/davy-blavette/DatatrainX/blob/main/dataset/fer2013/v1/accuracy/fer_best.png?raw=true)

# Résumé du modèle

Les couches du réseau de neurones à convolution utilisées dans la mise en œuvre de ce classificateur peuvent être résumées comme suit. Vous pouvez obtenir un résumé similaire en décommentant la fonction `model.summar()` avant d'exécuter la fonction train().

![layers](https://user-images.githubusercontent.com/3437490/160842085-53e6683f-9c98-46af-9592-630dfe972c76.png)
