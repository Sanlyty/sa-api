import { MetricType } from '../../collector/enums/metric-type.enum';
import { GraphDataDto } from '../models/dtos/graph-data.dto';
import { GraphSerie } from '../models/dtos/graph-serie.dto';
import { TypeMappingUtils } from '../utils/type-mapping.utils';

export class GraphDataTransformer {
    static transform(data: { type: MetricType; data: unknown[] }[]) {
        const resultDto = new GraphDataDto();

        resultDto.data = data.map(
            (serie) =>
                new GraphSerie(
                    TypeMappingUtils.resolveMetricType(serie.type),
                    // Values
                    serie.data.map(({ date: x, value }) => ({
                        x,
                        y: this.parseNumber(value),
                    }))
                )
        );

        return resultDto;
    }

    static parseNumber(value) {
        return typeof value === 'number' ? parseFloat(value.toFixed(2)) : 0.0;
    }
}
