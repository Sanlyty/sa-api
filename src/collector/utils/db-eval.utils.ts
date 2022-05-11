export class DbEvalUtils {
    public static coalesce<T>(...values: T[]): T {
        return values.find((value) => value !== undefined && value !== null);
    }
}
