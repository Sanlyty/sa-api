import { Cron } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';

import { DatabaseAdminitrationService } from '../services/database-adminitration.service';

@Injectable()
export class MaterializedViewRefresher {
    constructor(private adminService: DatabaseAdminitrationService) {}

    @Cron('0 0 */2 * * *')
    public async refreshMaterializedViews() {
        await this.adminService.refreshMaterializedViews();
    }
}
