import { PeriodType } from '../../../collector/enums/period-type.enum';

export type OutputType = 'FLAT' | 'HIERARCHY';

export interface StatisticQueryParams {
    // @IsValidDate({ message: 'Date \'$value\' is not valid value of query param \'date\'' })
    date?: Date;
    period?: PeriodType;
    metricFilter?: string[];
    orderBy?: string[];
    referenceId?: string[];
    tier?: string[];
    output?: OutputType;

    fromDate?: number;
    toDate?: number;
}
