# -*- coding: utf-8 -*-
import numpy as np
import pandas as pd
import tensorflow as tf
import time
import matplotlib.pyplot as plt
import seaborn as sns
import tensorflowjs as tfjs

from sklearn.model_selection import train_test_split
from keras.models import model_from_json
from sklearn.metrics import confusion_matrix
from models import models
from time import gmtime, strftime


# preprocessing
def preprocessing():
    # lecture du datset d'origine
    data = pd.read_csv('../data/fer2013.csv')
    datapoints = data['pixels'].tolist()
    # génération d'un tableau d'images en préparation CNN
    X = []
    for xseq in datapoints:
        xx = [int(xp) for xp in xseq.split(' ')]
        xx = np.asarray(xx).reshape(width, height)
        X.append(xx.astype('float32'))

    X = np.asarray(X)
    X = np.expand_dims(X, -1)
    # génération d'un tableau de labels émotions en préparation CNN
    y = pd.get_dummies(data['emotion']).to_numpy()
    # sauvegarde des informations pour traitement ultérieur
    np.save('./preprocessing/fdataX', X)
    np.save('./preprocessing/flabels', y)
    np.save('./preprocessing/features', X[0])

    print("Preprocessing Done")
    print("Number of Features: " + str(len(X[0])))
    print("Number of Labels: " + str(len(y[0])))
    print("Number of examples in dataset:" + str(len(X)))
    print("X,y stored in fdataX.npy and flabels.npy respectively")


# train
def train():
    if tf.test.is_built_with_cuda():
        # for xx in range(10):
        #    plt.figure(xx)
        #    plt.imshow(x[xx].reshape((48, 48)), interpolation='none', cmap='gray')
        # plt.show()
        start = time.time()

        # Load model, custom or Keras

        try:
            model = getattr(models.Models(), modelName)(width=width, height=height, filters=filters,
                                                        num_labels=num_labels)
        except:
            model = models.Models().load(modelName=modelName, width=width, height=height, filters=filters)

        model.summary()

        x = np.load('./preprocessing/fdataX.npy')
        y = np.load('./preprocessing/flabels.npy')
        x -= np.mean(x, axis=0)
        x /= np.std(x, axis=0)
        # splitting into training, validation and testing data
        [x_train, x_test, y_train, y_test] = train_test_split(x, y, test_size=0.1, random_state=42)
        [x_train, x_valid, y_train, y_valid] = train_test_split(x_train, y_train, test_size=0.1, random_state=41)

        # training the model
        model.fit(np.array(x_train), np.array(y_train),
                  batch_size=batch_size,
                  epochs=epochs,
                  verbose=1,
                  validation_data=(np.array(x_valid), np.array(y_valid)),
                  shuffle=True)

        end = time.time()
        timer = int(end - start)

        fer_json = model.to_json()
        with open(f"./weights/fer_{modelName}.json", "w") as json_file:
            json_file.write(fer_json)

        model.save_weights(f"./weights/fer_{modelName}_weights.h5")
        model.save(f"./weights/fer_{modelName}_best.h5")
        model.save_weights(f"./weights/archives/{log}_fer_{modelName}_weights.h5")
        model.save(f"./weights/archives/{log}_fer_{modelName}_best.h5")
        # saving the test samples to be used later
        np.save(f'./accuracy/modXtest', x_test)
        np.save(f'./accuracy/modYtest', y_test)

        print("Saved model to disk")
        # total time taken
        print(f"Runtime of the program is {timer}")


def matrix(path):
    json_file = open(path + 'fer_' + modelName + '.json', 'r')
    loaded_model_json = json_file.read()
    json_file.close()
    loaded_model = model_from_json(loaded_model_json)
    # load weights into new model
    loaded_model.load_weights(path + "fer_" + modelName + "_best.h5")
    print("Loaded model from disk")

    y_true = []
    y_pred = []
    x = np.load(f'./accuracy/modXtest.npy')
    y = np.load(f'./accuracy/modYtest.npy')

    yhat = loaded_model.predict(x)
    yh = yhat.tolist()
    yt = y.tolist()
    count = 0

    for i in range(len(y)):
        yy = max(yh[i])
        yyt = max(yt[i])
        y_pred.append(yh[i].index(yy))
        y_true.append(yt[i].index(yyt))
        if yh[i].index(yy) == yt[i].index(yyt):
            count += 1

    acc = round((count / len(y)) * 100, 2)

    print("Predicted and true label values saved")
    print("Accuracy on test set :" + str(acc) + "%")

    cm = confusion_matrix(y_true, y_pred)
    cmn = cm.astype('float') / cm.sum(axis=1)[:, np.newaxis]
    sns.heatmap(cmn, annot=True, fmt='.2f', xticklabels=labels, yticklabels=labels, cmap=plt.cm.jet)
    plt.title('DataTrainX, Matrice de confusion FER2013\n' + modelName.upper() + " - " + str(acc) + "%")
    plt.ylabel('Actuel')
    plt.xlabel('Prédiction')
    print(cm)

    plt.savefig(f'./accuracy/archives/{log}_fer_best.png')
    plt.savefig(f'./accuracy/fer_{modelName}_best.png')

    plt.show()


def convertModel():
    model = models.Models().loadH5(path="./weights/fer_" + modelName + "_best.h5")
    # export to tf.js layer
    tfjs.converters.save_keras_model(model, f"./weights/tfjs/fer_{modelName}")


def main():
    global log, modelName, width, height, filters, num_labels, batch_size, epochs, labels

    # train, choose your model
    modelName = "tinyVGG"
    # model config epoch, batch_size, filters
    model = {"cnn": [300, 256, 64],
             "dcnn": [300, 256, 64],
             "ednn": [1000, 256, 32],
             "deep": [300, 256, 64],
             "tinyVGG": [1000, 32, 10],
             "VGG19": [100, 256, 64],
             "ResNet152V2": [100, 256, 64],
             "NASNetLarge": [100, 64, 64]}
    # taille des images
    width, height = 48, 48
    labels = ['Colère', 'Dégoût', 'Peur', 'Joyeux', 'Triste', 'Surprise', 'Neutre']

    log = strftime("%Y%m%d_%H%M", gmtime())
    num_labels = len(labels)
    batch_size = model[modelName][1]
    epochs = model[modelName][0]
    filters = model[modelName][2]

    # first step preprocessing
    # preprocessing()
    train()
    matrix('./weights/')
    convertModel()


if __name__ == '__main__':
    main()
