from keras.layers import Dense, Dropout, Flatten, Input, Conv2D, MaxPooling2D, BatchNormalization, concatenate, \
    Activation
from keras.losses import categorical_crossentropy
from keras.regularizers import l2
from keras.optimizers import Adam, SGD
from keras.models import Sequential, Model, load_model
import keras.applications


class Models:

    def loadH5(self, path):
        return load_model(path)

    def load(self, modelName, width, height, num_labels):
        base_model = getattr(keras.applications, modelName)(include_top=False,
                                                            weights=None,
                                                            input_shape=(width, height, 1),
                                                            pooling="avg")

        emotion = Dense(units=num_labels, kernel_initializer="he_normal", use_bias=False,
                        activation="softmax", name="emotion")(base_model.output)
        model = Model(inputs=base_model.input, outputs=emotion)
        model.compile(loss=categorical_crossentropy,
                      optimizer=Adam(learning_rate=0.001, beta_1=0.9, beta_2=0.999, epsilon=1e-07),
                      metrics=['accuracy'])

        return model

    # 65%
    def cnn(self, width, height, filters, num_labels):
        model = Sequential(name='CNN')

        model.add(Conv2D(filters, kernel_size=(3, 3), activation='relu', input_shape=(width, height, 1),
                         data_format='channels_last', kernel_regularizer=l2(0.01)))
        model.add(Conv2D(filters, kernel_size=(3, 3), activation='relu', padding='same'))
        model.add(BatchNormalization())
        model.add(MaxPooling2D(pool_size=(2, 2), strides=(2, 2)))
        model.add(Dropout(0.5))

        model.add(Conv2D(2 * filters, kernel_size=(3, 3), activation='relu', padding='same'))
        model.add(BatchNormalization())
        model.add(Conv2D(2 * filters, kernel_size=(3, 3), activation='relu', padding='same'))
        model.add(BatchNormalization())
        model.add(MaxPooling2D(pool_size=(2, 2), strides=(2, 2)))
        model.add(Dropout(0.5))

        model.add(Conv2D(2 * 2 * filters, kernel_size=(3, 3), activation='relu', padding='same'))
        model.add(BatchNormalization())
        model.add(Conv2D(2 * 2 * filters, kernel_size=(3, 3), activation='relu', padding='same'))
        model.add(BatchNormalization())
        model.add(MaxPooling2D(pool_size=(2, 2), strides=(2, 2)))
        model.add(Dropout(0.5))

        model.add(Conv2D(2 * 2 * 2 * filters, kernel_size=(3, 3), activation='relu', padding='same'))
        model.add(BatchNormalization())
        model.add(Conv2D(2 * 2 * 2 * filters, kernel_size=(3, 3), activation='relu', padding='same'))
        model.add(BatchNormalization())
        model.add(MaxPooling2D(pool_size=(2, 2), strides=(2, 2)))
        model.add(Dropout(0.5))

        model.add(Flatten())

        model.add(Dense(2 * 2 * 2 * filters, activation='relu'))
        model.add(Dropout(0.4))
        model.add(Dense(2 * 2 * filters, activation='relu'))
        model.add(Dropout(0.4))
        model.add(Dense(2 * filters, activation='relu'))
        model.add(Dropout(0.5))

        model.add(Dense(num_labels, activation='softmax'))
        # Compilation du modèle avec l'optimiseur Adam et la perte d'entropie croisée catégorique
        model.compile(loss=categorical_crossentropy,
                      optimizer=Adam(learning_rate=0.001, beta_1=0.9, beta_2=0.999, epsilon=1e-07),
                      metrics=['accuracy'])

        return model

    def dcnn(self, width, height, filters, num_labels):
        model = Sequential(name='DCNN')

        model.add(Conv2D(filters=filters, kernel_size=(5, 5), input_shape=(width, height, 1), activation='elu',
                         padding='same', kernel_initializer='he_normal', name='conv2d_1'))
        model.add(BatchNormalization(name='batchnorm_1'))
        model.add(Conv2D(filters=filters, kernel_size=(5, 5), activation='elu', padding='same',
                         kernel_initializer='he_normal', name='conv2d_2'))
        model.add(BatchNormalization(name='batchnorm_2'))
        model.add(MaxPooling2D(pool_size=(2, 2), name='maxpool2d_1'))
        model.add(Dropout(0.4, name='dropout_1'))

        model.add(Conv2D(filters=2 * filters, kernel_size=(3, 3), activation='elu', padding='same',
                         kernel_initializer='he_normal', name='conv2d_3'))
        model.add(BatchNormalization(name='batchnorm_3'))
        model.add(Conv2D(filters=2 * filters, kernel_size=(3, 3), activation='elu', padding='same',
                         kernel_initializer='he_normal', name='conv2d_4'))
        model.add(BatchNormalization(name='batchnorm_4'))

        model.add(MaxPooling2D(pool_size=(2, 2), name='maxpool2d_2'))
        model.add(Dropout(0.4, name='dropout_2'))

        model.add(Conv2D(filters=2 * 2 * filters, kernel_size=(3, 3), activation='elu', padding='same',
                         kernel_initializer='he_normal', name='conv2d_5'))
        model.add(BatchNormalization(name='batchnorm_5'))
        model.add(Conv2D(filters=2 * 2 * filters, kernel_size=(3, 3), activation='elu', padding='same',
                         kernel_initializer='he_normal', name='conv2d_6'))
        model.add(BatchNormalization(name='batchnorm_6'))

        model.add(MaxPooling2D(pool_size=(2, 2), name='maxpool2d_3'))
        model.add(Dropout(0.5, name='dropout_3'))

        model.add(Flatten(name='flatten'))

        model.add(Dense(2 * filters, activation='elu', kernel_initializer='he_normal', name='dense_1'))
        model.add(BatchNormalization(name='batchnorm_7'))

        model.add(Dropout(0.6, name='dropout_4'))

        model.add(Dense(num_labels, activation='softmax', name='out_layer'))

        # Compilation du modèle avec l'optimiseur Adam et la perte d'entropie croisée catégorique
        model.compile(loss=categorical_crossentropy,
                      optimizer=Adam(learning_rate=0.001, beta_1=0.9, beta_2=0.999, epsilon=1e-07),
                      metrics=['accuracy'])
        return model

    def ednn(self, width, height, filters, num_labels):
        """
            EDNN model for FER by Deepak Kumar Jaina, Pourya Shamsolmoalib &
            Paramjit Sehdev, as it appears in "Extended deep neural network for
            facial emotion recognition", 2019.
            """

        x = Input(shape=(width, height, 1))
        y = Conv2D(filters, (5, 5), input_shape=(width, height, 1), strides=(2, 2),
                   data_format='channels_last')(x)
        y = MaxPooling2D(pool_size=(2, 2))(y)
        y = Conv2D(filters * 2, (3, 3), strides=(1, 1))(y)
        y = self.ResidualBlock(y)
        y = Conv2D(filters * 4, (3, 3), strides=(1, 1), padding="same")(y)
        y = MaxPooling2D(pool_size=(2, 2))(y)
        y = Conv2D(filters * 4, (3, 3), strides=(1, 1))(y)
        y = self.ResidualBlock(y)
        y = Conv2D(filters * 8, (3, 3), strides=(1, 1), padding="same")(y)
        y = MaxPooling2D(pool_size=(2, 2))(y)
        y = Conv2D(filters * 16, (3, 3), strides=(1, 1), padding="same")(y)
        y = Flatten()(y)
        y = Dense(filters * 32, activation='relu')(y)
        y = Dropout(0.2)(y)
        y = Dense(filters * 16, activation='relu')(y)
        y = Dropout(0.2)(y)
        y = Dense(num_labels, activation='softmax')(y)

        # Create model:
        model = Model(x, y)

        # Compile model: LRATE/EPOCHS
        opt = SGD(lr=1e-4, momentum=0.9, decay=1e-4 / 12)
        model.compile(loss='categorical_crossentropy',
                      optimizer=opt, metrics=['accuracy'])

        return model

    def ResidualBlock(self, prev_layer):
        """Residual block from the EDNN model for FER by Deepak Kumar Jaina,
        Pourya Shamsolmoalib & Paramjit Sehdev, as it appears in "Extended
        deep neural network for facial emotion recognition", 2019.
        """
        conv_1 = Conv2D(64, (1, 1))(prev_layer)
        conv_2 = Conv2D(64, (3, 3), padding="same")(conv_1)
        shortc = concatenate([conv_1, conv_2], axis=-1)
        conv_3 = Conv2D(128, (3, 3), padding="same")(shortc)
        conv_4 = Conv2D(256, (1, 1))(conv_3)
        output = concatenate([conv_4, prev_layer], axis=-1)

        return output

    def deep(self, width, height, filters, num_labels):
        model = Sequential(name='DeepEmotion')
        model.add(Conv2D(filters=filters, kernel_size=(3, 3), input_shape=(width, height, 1), padding='same',
                         kernel_initializer='he_normal'))
        model.add(BatchNormalization())
        model.add(Activation('relu'))

        model.add(Conv2D(filters=filters, kernel_size=(3, 3), padding='same', kernel_initializer="he_normal"))
        model.add(BatchNormalization())
        model.add(Activation('relu'))
        model.add(MaxPooling2D((2, 2)))

        model.add(Dropout(0.5))
        model.add(Conv2D(filters=filters * 2, kernel_size=(3, 3), padding='same', kernel_initializer="he_normal"))
        model.add(BatchNormalization())
        model.add(Activation('relu'))
        model.add(Conv2D(filters=filters * 2, kernel_size=(3, 3), padding='same', kernel_initializer="he_normal"))
        model.add(BatchNormalization())
        model.add(Activation('relu'))
        model.add(MaxPooling2D((2, 2)))

        model.add(Dropout(0.5))
        model.add(
            Conv2D(filters=filters * 2 * 2, kernel_size=(3, 3), padding='same', kernel_initializer="he_normal"))
        model.add(BatchNormalization())
        model.add(Activation('relu'))
        model.add(
            Conv2D(filters=filters * 2 * 2, kernel_size=(3, 3), padding='same', kernel_initializer="he_normal"))
        model.add(BatchNormalization())
        model.add(Activation('relu'))
        model.add(MaxPooling2D((2, 2)))

        model.add(Dropout(0.5))
        model.add(Conv2D(filters=filters * 2 * 2 * 2, kernel_size=(3, 3), padding='same',
                         kernel_initializer="he_normal"))
        model.add(BatchNormalization())
        model.add(Activation('relu'))
        model.add(Conv2D(filters=filters * 2 * 2 * 2, kernel_size=(3, 3), padding='same',
                         kernel_initializer="he_normal"))
        model.add(BatchNormalization())
        model.add(Activation('relu'))
        model.add(MaxPooling2D((2, 2)))

        model.add(Flatten())

        model.add(Dropout(0.5))
        model.add(Dense(filters * 2 * 2 * 2 * 2))
        model.add(BatchNormalization())
        model.add(Activation('relu'))

        model.add(Dense(num_labels, activation='softmax'))

        # model.compile(optimizer=SGD(learning_rate=0.1, momentum=0.9, decay=0.0001))
        model.compile(loss=categorical_crossentropy,
                      optimizer=Adam(learning_rate=0.001, beta_1=0.9, beta_2=0.999, epsilon=1e-07),
                      metrics=['accuracy'])

        return model

    # for CNN Explainer
    def tinyVGG(self, width, height, filters, num_labels):
        """
        Tiny VGG structure is adapted from http://cs231n.stanford.edu:
            > This particular network is classifying CIFAR-10 images into one of 10
            > classes and was trained with ConvNetJS. Its exact architecture is
            > [conv-relu-conv-relu-pool]x3-fc-softmax, for a total of 17 layers and
            > 7000 parameters. It uses 3x3 convolutions and 2x2 pooling regions.
        """
        model = Sequential(name='tinyVGG')

        model.add(Conv2D(filters=filters, kernel_size=(3, 3), input_shape=(width, height, 1), padding='same',
                         kernel_initializer='he_normal', name='conv_1_1'))
        model.add(Activation('relu', name='relu_1_1'))
        model.add(Conv2D(filters=filters, kernel_size=(3, 3), padding='same', kernel_initializer="he_normal",
                         name='conv_1_2'))
        model.add(Activation('relu', name='relu_1_2'))
        model.add(MaxPooling2D((2, 2), name='max_pool_1'))
        model.add(Conv2D(filters=filters, kernel_size=(3, 3), padding='same', kernel_initializer="he_normal",
                         name='conv_2_1'))
        model.add(Activation('relu', name='relu_2_1'))
        model.add(Conv2D(filters=filters, kernel_size=(3, 3), padding='same', kernel_initializer="he_normal",
                         name='conv_2_2'))
        model.add(Activation('relu', name='relu_2_2'))
        model.add(MaxPooling2D((2, 2), name='max_pool_2'))
        model.add(Flatten())
        model.add(Dense(num_labels, activation='softmax', name='output'))
        model.compile(loss=categorical_crossentropy,
                      optimizer=Adam(learning_rate=0.001, beta_1=0.9, beta_2=0.999, epsilon=1e-07),
                      metrics=['accuracy'])

        return model
