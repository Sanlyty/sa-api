import { Controller, Get } from '@nestjs/common';
import { DatabaseAdminitrationService } from '../services/database-adminitration.service';

@Controller('/api/v1/admin')
export class AdminController {
    constructor(private administrationService: DatabaseAdminitrationService) {}

    @Get('/refresh-views')
    public async refreshViews() {
        await this.administrationService.refreshMaterializedViews();
    }
}
