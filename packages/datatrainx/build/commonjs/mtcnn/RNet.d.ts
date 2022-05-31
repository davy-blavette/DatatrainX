
import { RNetParams } from './types';
export declare function RNet(x: tf.Tensor4D, params: RNetParams): {
    scores: tf.Tensor1D;
    regions: tf.Tensor2D;
};
