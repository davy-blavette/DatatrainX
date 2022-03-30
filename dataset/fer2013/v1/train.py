# -*- coding: utf-8 -*-
import numpy as np
import pandas as pd
import tensorflow as tf
import time
from sklearn.model_selection import train_test_split
from keras.models import Sequential
from keras.layers import Dense, Dropout, Flatten
from keras.layers import Conv2D, MaxPooling2D, BatchNormalization
from keras.losses import categorical_crossentropy
from keras.regularizers import l2
from keras.optimizers import Adam

from keras.models import model_from_json
from sklearn.metrics import confusion_matrix

# matrix
import matplotlib.pyplot as plt
import itertools

from time import gmtime, strftime
import seaborn as sns


# preprocessing
def preprocessing():
    data = pd.read_csv('../data/fer2013.csv')

    width, height = 48, 48

    datapoints = data['pixels'].tolist()

    # getting features for training
    X = []
    for xseq in datapoints:
        xx = [int(xp) for xp in xseq.split(' ')]
        xx = np.asarray(xx).reshape(width, height)
        X.append(xx.astype('float32'))

    X = np.asarray(X)
    X = np.expand_dims(X, -1)

    # getting labels for training
    y = pd.get_dummies(data['emotion']).to_numpy()

    # storing them using numpy
    np.save('./preprocessing/fdataX', X)
    np.save('./preprocessing/flabels', y)

    print("Preprocessing Done")
    print("Number of Features: " + str(len(X[0])))
    print("Number of Labels: " + str(len(y[0])))
    print("Number of examples in dataset:" + str(len(X)))
    print("X,y stored in fdataX.npy and flabels.npy respectively")


# train
def train():
    start = time.time()
    num_features: int = 64
    num_labels = 7
    batch_size = 64
    epochs = 100
    width, height = 48, 48

    x = np.load('./preprocessing/fdataX.npy')
    y = np.load('./preprocessing/flabels.npy')

    x -= np.mean(x, axis=0)
    x /= np.std(x, axis=0)

    isCUDA = tf.test.is_built_with_cuda()

    if isCUDA:
        # for xx in range(10):
        #    plt.figure(xx)
        #    plt.imshow(x[xx].reshape((48, 48)), interpolation='none', cmap='gray')
        # plt.show()

        # splitting into training, validation and testing data
        [X_train, X_test, y_train, y_test] = train_test_split(x, y, test_size=0.1, random_state=42)
        [X_train, X_valid, y_train, y_valid] = train_test_split(X_train, y_train, test_size=0.1, random_state=41)

        # saving the test samples to be used later
        np.save(f'./accuracy/archives/{filename}_modXtest', X_test)
        np.save(f'./accuracy/archives/{filename}_modYtest', y_test)
        np.save(f'./accuracy/modXtest', X_test)
        np.save(f'./accuracy/modYtest', y_test)
        # designing the CNN
        model = Sequential()

        model.add(Conv2D(num_features, kernel_size=(3, 3), activation='relu', input_shape=(width, height, 1),
                         data_format='channels_last', kernel_regularizer=l2(0.01)))
        model.add(Conv2D(num_features, kernel_size=(3, 3), activation='relu', padding='same'))
        model.add(BatchNormalization())
        model.add(MaxPooling2D(pool_size=(2, 2), strides=(2, 2)))
        model.add(Dropout(0.5))

        model.add(Conv2D(2 * num_features, kernel_size=(3, 3), activation='relu', padding='same'))
        model.add(BatchNormalization())
        model.add(Conv2D(2 * num_features, kernel_size=(3, 3), activation='relu', padding='same'))
        model.add(BatchNormalization())
        model.add(MaxPooling2D(pool_size=(2, 2), strides=(2, 2)))
        model.add(Dropout(0.5))

        model.add(Conv2D(2 * 2 * num_features, kernel_size=(3, 3), activation='relu', padding='same'))
        model.add(BatchNormalization())
        model.add(Conv2D(2 * 2 * num_features, kernel_size=(3, 3), activation='relu', padding='same'))
        model.add(BatchNormalization())
        model.add(MaxPooling2D(pool_size=(2, 2), strides=(2, 2)))
        model.add(Dropout(0.5))

        model.add(Conv2D(2 * 2 * 2 * num_features, kernel_size=(3, 3), activation='relu', padding='same'))
        model.add(BatchNormalization())
        model.add(Conv2D(2 * 2 * 2 * num_features, kernel_size=(3, 3), activation='relu', padding='same'))
        model.add(BatchNormalization())
        model.add(MaxPooling2D(pool_size=(2, 2), strides=(2, 2)))
        model.add(Dropout(0.5))

        model.add(Flatten())

        model.add(Dense(2 * 2 * 2 * num_features, activation='relu'))
        model.add(Dropout(0.4))
        model.add(Dense(2 * 2 * num_features, activation='relu'))
        model.add(Dropout(0.4))
        model.add(Dense(2 * num_features, activation='relu'))
        model.add(Dropout(0.5))

        model.add(Dense(num_labels, activation='softmax'))

        model.summary()

        # Compiling the model with adam optimizer and categorical cross entropy loss
        model.compile(loss=categorical_crossentropy,
                      optimizer=Adam(learning_rate=0.001, beta_1=0.9, beta_2=0.999, epsilon=1e-07),
                      metrics=['accuracy'])

        # training the model
        model.fit(np.array(X_train), np.array(y_train),
                  batch_size=batch_size,
                  epochs=epochs,
                  verbose=1,
                  validation_data=(np.array(X_valid), np.array(y_valid)),
                  shuffle=True)

        # saving the  model to be used later

        end = time.time()
        timer = int(end - start)

        fer_json = model.to_json()
        with open(f"./weights/fer.json", "w") as json_file:
            json_file.write(fer_json)

        model.save_weights(f"./weights/fer_weights.h5")
        model.save(f"./weights/fer_best.h5")
        model.save_weights(f"./weights/archives/{filename}_fer_weights.h5")
        model.save(f"./weights/archives/{filename}_fer_best.h5")

        print("Saved model to disk")
        # total time taken
        print(f"Runtime of the program is {timer}")


# accuracy
def accuracy():
    json_file = open(f'./weights/fer.json', 'r')
    loaded_model_json = json_file.read()
    json_file.close()
    loaded_model = model_from_json(loaded_model_json)
    # load weights into new model
    loaded_model.load_weights(f"./weights/fer_best.h5")
    print("Loaded model from disk")

    truey = []
    predy = []
    x = np.load(f'./accuracy/modXtest.npy')
    y = np.load(f'./accuracy/modytest.npy')

    yhat = loaded_model.predict(x)
    yh = yhat.tolist()
    yt = y.tolist()
    count = 0

    for i in range(len(y)):
        yy = max(yh[i])
        yyt = max(yt[i])
        predy.append(yh[i].index(yy))
        truey.append(yt[i].index(yyt))
        if yh[i].index(yy) == yt[i].index(yyt):
            count += 1

    acc = (count / len(y)) * 100

    # saving values for confusion matrix and analysis
    np.save(f'./accuracy/archives/{filename}_truey', truey)
    np.save(f'./accuracy/archives/{filename}_predy', predy)
    np.save(f'./accuracy/truey', truey)
    np.save(f'./accuracy/predy', predy)
    print("Predicted and true label values saved")
    print("Accuracy on test set :" + str(acc) + "%")
    return acc


# matrix
def matrix():
    y_true = np.load(f'./accuracy/truey.npy')
    y_pred = np.load(f'./accuracy/predy.npy')

    cm = confusion_matrix(y_true, y_pred)
    labels = ['Colère', 'Dégoût', 'Peur', 'Joyeux', 'Triste', 'Surprise', 'Neutre']

    # Normalise
    cmn = cm.astype('float') / cm.sum(axis=1)[:, np.newaxis]
    fig, ax = plt.subplots(figsize=(10, 10))
    sns.heatmap(cmn, annot=True, fmt='.2f', xticklabels=labels, yticklabels=labels, cmap=plt.cm.jet)

    plt.title('DataTrainX, Matrice de confusion FER2013\n' + str(acc) + "%")
    plt.ylabel('Actuel')
    plt.xlabel('Prédiction')
    print(cm)

    plt.savefig(f'./accuracy/archives/{filename}_fer_best.png')
    plt.savefig(f'./accuracy/fer_best.png')

    plt.show()


filename = strftime("%Y%m%d_%H%M", gmtime())

# preprocessing()
train()
acc = round(accuracy(), 2)
matrix()
