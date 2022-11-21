import { worker } from 'workerpool';
import { decode } from 'lz4';

function load(contents, label) {
    console.time(label + '_decode');
    const d = decode(contents);
    console.timeEnd(label + '_decode');

    return JSON.parse(d.toString());
}

worker({ load });
