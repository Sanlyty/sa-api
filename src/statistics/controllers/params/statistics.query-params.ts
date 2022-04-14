import { PeriodType } from '../../../collector/enums/period-type.enum';

export type OutputType = 'FLAT' | 'HIERARCHY';

export class StatisticQueryParams {
    // @IsValidDate({ message: 'Date \'$value\' is not valid value of query param \'date\'' })
    date: Date;
    period: PeriodType;
    metricFilter: string[];
    orderBy: string[];
    referenceId: string[];
    tier: string[];
    output: OutputType = 'FLAT';

    fromDate?: number;
    toDate?: number;
}
