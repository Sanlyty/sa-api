import { worker } from 'workerpool';
import { decode } from 'lz4';

function load(contents) {
    return JSON.parse(decode(contents).toString());
}

worker({ load });
