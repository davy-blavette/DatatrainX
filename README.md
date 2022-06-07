# DataTrainX
Outil de recherche des singularités cognitives d’un étudiant, basé sur le deep-learning en vue d’améliorer la neuropédagogie

Dans l’apprentissage, une logique de la restitution qui prévaut encore sur une logique de la compréhension serait à l’origine de nombreux échecs de l’apprenant. Pour se comprendre, comprendre le monde et autrui, tout apprenant produit et met en œuvre des ressources métacognitives. On observera que cela fait appel à de nombreuses disciplines, comme la psychologie, la pédagogie ou les neurosciences. DataTrainX est un prototype de reconnaissance facial des émotions (REF) qui a pour objectif principal de s’intéresser à l’analyse des comportements de l'apprenant dans un but de neuropédagogie. Pour ce faire, nous utiliserons des algorithmes de deep-Learning et plus particulièrement les réseaux de neurones convolutifs (CNN) dans la reconnaissance des émotions de bases définies par le psychologue P. Ekman. L’idée est de se concentrer sur la démarche que privilégie chaque individu pour appréhender l’acte d’apprendre. Dans le projet DataTrainx l’utilisateur sera enregistré en vidéo et une comparaison sera effectuée entre la typologie trouvée par le questionnaire de Kolb et les émotions qu’il aura exprimées. L’objectif est de trouver une corrélation entre la typologie d’apprentissage et l’émotion de l’utilisateur et de démontrer comment mettre en place l’architecture fonctionnelle, logicielle et matérielle pour arriver à un résultat applicatif sur la REF axé sur un profil d’apprentissage.

Mots clés : CNN, REF, Deep learning, Tensorflow, Dataset, Convolution, NodeJS, apprentissage, neurosciences, neuropédagogie, Kolb, vidéo.

In learning, the logic of restitution which still prevails over the logic of comprehension would be at the origin of many failures of the learner. To understand themselves, the world and others, all learners produce and implement metacognitive resources. We can notice that this calls upon many disciplines, such as psychology, pedagogy or neurosciences. DataTrainX is a prototype of Facial Emotion Recognition (FER) which main objective is to focus on the analysis of any learner behavior for the purpose of neuropedagogy. In order to achieve this, we will use deep-Learning algorithms and more particularly convolutional neural networks (CNN) in recognition of basic emotions defined by the psychologist P. Ekman. The idea is to focus on the approach that each individual favors to apprehend the act of learning. In the DataTrainx project the user will be recorded on video and a comparison will be made between the typology found by the Kolb questionnaire and the emotions he has expressed. The objective is to find a correlation between the learning typology and the user's emotion. The purpose of this project is to focus concretely on the IT functional means to be implemented for this type of application and being to demonstrate how to set up the functional, software and hardware architecture to arrive at an application result of FER.

Key words : CNN, REF, Deep learning, Tensorflow, Dataset, Convolution, NodeJS, learning, neurosciences, neuropedagogy, Kolb, video.


[![build](https://github.com/poloclub/cnn-explainer/workflows/build/badge.svg)](https://github.com/poloclub/cnn-explainer/actions)
[![arxiv badge](https://img.shields.io/badge/arXiv-2004.15004-red)](http://arxiv.org/abs/2004.15004)
[![DOI:10.1109/TVCG.2020.3030418](https://img.shields.io/badge/DOI-10.1109/TVCG.2020.3030418-blue)](https://doi.org/10.1109/TVCG.2020.3030418)

<a href="https://youtu.be/HnWIHWFbuUQ" target="_blank"><img src="https://i.imgur.com/sCsudVg.png" style="max-width:100%;"></a>

For more information, check out our manuscript:

[**CNN Explainer: Learning Convolutional Neural Networks with Interactive Visualization**](https://arxiv.org/abs/2004.15004).
Wang, Zijie J., Robert Turko, Omar Shaikh, Haekyu Park, Nilaksh Das, Fred Hohman, Minsuk Kahng, and Duen Horng Chau.
*IEEE Transactions on Visualization and Computer Graphics (TVCG), 2020.*

## Live Demo

For a live demo, visit: http://poloclub.github.io/cnn-explainer/

## Running Locally

Clone or download this repository:

```bash
git clone git@github.com:poloclub/cnn-explainer.git

# use degit if you don't want to download commit histories
degit poloclub/cnn-explainer
```

Install the dependencies:

```bash
npm install
```

Then run CNN Explainer:

```bash
npm run dev
```

Navigate to [localhost:5000](https://localhost:5000). You should see CNN Explainer running in your broswer :)

To see how we trained the CNN, visit the directory [`./tiny-vgg/`](tiny-vgg).
If you want to use CNN Explainer with your own CNN model or image classes, see [#8](/../../issues/8) and [#14](/../../issues/14).

## Credits

CNN Explainer was created by 
<a href="https://zijie.wang/">Jay Wang</a>,
<a href="https://www.linkedin.com/in/robert-turko/">Robert Turko</a>, 
<a href="http://oshaikh.com/">Omar Shaikh</a>,
<a href="https://haekyu.com/">Haekyu Park</a>,
<a href="http://nilakshdas.com/">Nilaksh Das</a>,
<a href="https://fredhohman.com/">Fred Hohman</a>,
<a href="http://minsuk.com">Minsuk Kahng</a>, and
<a href="https://www.cc.gatech.edu/~dchau/">Polo Chau</a>,
which was the result of a research collaboration between 
Georgia Tech and Oregon State.

We thank
[Anmol Chhabria](https://www.linkedin.com/in/anmolchhabria),
[Kaan Sancak](https://kaansancak.com),
[Kantwon Rogers](https://www.kantwon.com), and the
[Georgia Tech Visualization Lab](http://vis.gatech.edu)
for their support and constructive feedback.

## Citation

```bibTeX
@article{wangCNNExplainerLearning2020,
  title = {{{CNN Explainer}}: {{Learning Convolutional Neural Networks}} with {{Interactive Visualization}}},
  shorttitle = {{{CNN Explainer}}},
  author = {Wang, Zijie J. and Turko, Robert and Shaikh, Omar and Park, Haekyu and Das, Nilaksh and Hohman, Fred and Kahng, Minsuk and Chau, Duen Horng},
  journal={IEEE Transactions on Visualization and Computer Graphics (TVCG)},
  year={2020},
  publisher={IEEE}
}
```

## License

The software is available under the [MIT License](https://github.com/poloclub/cnn-explainer/blob/master/LICENSE).

## Contact

If you have any questions, feel free to [open an issue](https://github.com/poloclub/cnn-explainer/issues/new/choose) or contact [Jay Wang](https://zijie.wang).
