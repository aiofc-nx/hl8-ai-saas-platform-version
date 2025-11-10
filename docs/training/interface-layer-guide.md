# 接口层设计规范

## 📋 文档概述

本文档定义了基于 NestJS + DDD + Clean Architecture + CQRS + ES + EDA 混合架构的接口层设计原则和实施规范。接口层作为系统对外的门户，负责处理外部请求、数据转换和响应返回。

## 🎯 核心设计理念

### 1.1 接口层定位

**接口层**是系统的**对外门户**和**协议适配器**，在 Clean Architecture 中处于最外层，负责：
- 接收和验证外部输入
- 转换外部 DTO 为内部命令/查询
- 调用应用层用例
- 返回标准化响应
- 处理跨领域关注点（认证、授权、限流等）

### 1.2 核心原则

- **薄控制器**: 控制器只负责协调，不包含业务逻辑
- **协议无关性**: 核心业务逻辑不依赖特定协议（HTTP/GraphQL/gRPC）
- **输入验证**: 所有外部输入必须经过严格验证
- **统一响应**: 标准化响应格式和错误处理
- **可观测性**: 完整的日志、监控和追踪

## 🏗 接口层结构规范

### 2.1 分层与职责

```
interfaces/
├── rest/                          # REST API 接口
│   ├── controllers/               # 控制器
│   ├── dtos/                      # 请求/响应 DTO
│   ├── pipes/                     # 验证管道
│   ├── filters/                   # 异常过滤器
│   ├── guards/                    # 守卫（认证授权）
│   ├── interceptors/              # 拦截器
│   └── decorators/                # 自定义装饰器
├── graphql/                       # GraphQL API 接口
│   ├── resolvers/                 # 解析器
│   ├── schemas/                   # GraphQL Schema
│   └── dtos/                      # GraphQL DTO
├── websockets/                    # WebSocket 接口
│   ├── gateways/                  # 网关
│   └── adapters/                  # 适配器
├── rpc/                           # gRPC 接口
│   ├── controllers/               # gRPC 控制器
│   └── protos/                    # Proto 定义
└── cli/                           # 命令行接口
    ├── commands/                  # 命令
    └── questions/                 # 交互式问题
```

## 🌐 REST API 设计规范

### 3.1 控制器设计

```typescript
// 订单控制器
@ApiTags('orders')
@Controller('orders')
@UseInterceptors(LoggingInterceptor, TransformInterceptor)
@UseFilters(GlobalExceptionFilter, BusinessExceptionFilter)
export class OrderController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly orderAssembler: OrderAssembler
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiOperation({ summary: '创建订单', description: '创建新的客户订单' })
  @ApiResponse({ 
    status: 201, 
    description: '订单创建成功',
    type: OrderResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: '请求参数错误',
    type: ErrorResponseDto
  })
  async createOrder(
    @CurrentUser() user: CurrentUserDto,
    @Body() createOrderDto: CreateOrderRequestDto
  ): Promise<ApiResponse<OrderResponseDto>> {
    // 转换为应用层命令
    const command = this.orderAssembler.toCreateOrderCommand(createOrderDto, user.id);
    
    // 发送命令到应用层
    const result = await this.commandBus.execute(command);
    
    // 转换为响应 DTO
    const response = this.orderAssembler.toOrderResponseDto(result);
    
    return ApiResponse.success(response, '订单创建成功');
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取订单详情' })
  @ApiParam({ name: 'id', description: '订单ID' })
  async getOrder(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') orderId: string
  ): Promise<ApiResponse<OrderDetailResponseDto>> {
    const query = new GetOrderDetailQuery(orderId, user.id);
    const order = await this.queryBus.execute(query);
    
    const response = this.orderAssembler.toOrderDetailResponseDto(order);
    return ApiResponse.success(response);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiOperation({ summary: '取消订单' })
  async cancelOrder(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') orderId: string,
    @Body() cancelOrderDto: CancelOrderRequestDto
  ): Promise<ApiResponse<void>> {
    const command = new CancelOrderCommand(
      orderId,
      user.id,
      cancelOrderDto.reason,
      cancelOrderDto.cancellationType
    );
    
    await this.commandBus.execute(command);
    
    return ApiResponse.success(null, '订单取消成功');
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '查询订单列表' })
  async getOrders(
    @CurrentUser() user: CurrentUserDto,
    @Query() queryDto: OrderQueryRequestDto
  ): Promise<ApiResponse<PaginatedResponse<OrderResponseDto>>> {
    const query = this.orderAssembler.toOrderQuery(queryDto, user.id);
    const paginatedResult = await this.queryBus.execute(query);
    
    const response = this.orderAssembler.toPaginatedOrderResponse(paginatedResult);
    return ApiResponse.success(response);
  }
}
```

### 3.2 DTO 设计规范

```typescript
// 请求 DTO
export class CreateOrderRequestDto {
  @ApiProperty({ description: '订单项列表', type: [OrderItemRequestDto] })
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderItemRequestDto)
  items: OrderItemRequestDto[];

  @ApiProperty({ description: '收货地址ID' })
  @IsUUID()
  shippingAddressId: string;

  @ApiProperty({ description: '支付方式', enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ description: '优惠码', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  promoCode?: string;

  @ApiProperty({ description: '客户备注', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerNote?: string;
}

export class OrderItemRequestDto {
  @ApiProperty({ description: '商品ID' })
  @IsUUID()
  productId: string;

  @ApiProperty({ description: '购买数量' })
  @IsInt()
  @Min(1)
  @Max(999)
  quantity: number;

  @ApiProperty({ description: '商品规格', required: false })
  @IsOptional()
  @IsObject()
  specifications?: Record<string, any>;
}

// 响应 DTO
export class OrderResponseDto {
  @ApiProperty({ description: '订单ID' })
  id: string;

  @ApiProperty({ description: '订单号' })
  orderNumber: string;

  @ApiProperty({ description: '订单状态', enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty({ description: '订单总金额' })
  totalAmount: number;

  @ApiProperty({ description: '货币类型' })
  currency: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '订单项', type: [OrderItemResponseDto] })
  items: OrderItemResponseDto[];
}

export class OrderDetailResponseDto extends OrderResponseDto {
  @ApiProperty({ description: '收货地址' })
  shippingAddress: AddressResponseDto;

  @ApiProperty({ description: '支付信息' })
  paymentInfo: PaymentInfoResponseDto;

  @ApiProperty({ description: '物流信息' })
  shippingInfo: ShippingInfoResponseDto;

  @ApiProperty({ description: '订单操作日志' })
  activityLog: OrderActivityResponseDto[];
}
```

### 3.3 装配器（Assembler）设计

```typescript
@Injectable()
export class OrderAssembler {
  constructor(
    private readonly validationService: ValidationService,
    private readonly logger: Logger
  ) {}

  toCreateOrderCommand(dto: CreateOrderRequestDto, customerId: string): CreateOrderCommand {
    // 验证业务规则
    this.validationService.validateOrderItems(dto.items);

    return new CreateOrderCommand({
      customerId,
      items: dto.items.map(item => ({
        productId: ProductId.create(item.productId),
        quantity: item.quantity,
        specifications: item.specifications
      })),
      shippingAddressId: ShippingAddressId.create(dto.shippingAddressId),
      paymentMethod: dto.paymentMethod,
      promoCode: dto.promoCode,
      customerNote: dto.customerNote,
      requestedAt: new Date()
    });
  }

  toOrderResponseDto(order: Order): OrderResponseDto {
    return {
      id: order.id.value,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount.amount,
      currency: order.totalAmount.currency,
      createdAt: order.createdAt.toJSDate(),
      items: order.items.map(item => this.toOrderItemResponseDto(item))
    };
  }

  toOrderDetailResponseDto(order: Order): OrderDetailResponseDto {
    const baseResponse = this.toOrderResponseDto(order);
    
    return {
      ...baseResponse,
      shippingAddress: this.toAddressResponseDto(order.shippingAddress),
      paymentInfo: this.toPaymentInfoResponseDto(order.payment),
      shippingInfo: order.shipping ? this.toShippingInfoResponseDto(order.shipping) : null,
      activityLog: order.activityLog.map(activity => 
        this.toOrderActivityResponseDto(activity)
      )
    };
  }

  toOrderQuery(dto: OrderQueryRequestDto, customerId: string): OrderQuery {
    return new OrderQuery({
      customerId,
      status: dto.status,
      dateRange: dto.startDate && dto.endDate ? {
        start: new Date(dto.startDate),
        end: new Date(dto.endDate)
      } : undefined,
      pagination: {
        page: dto.page || 1,
        pageSize: dto.pageSize || 20,
        sortBy: dto.sortBy,
        sortOrder: dto.sortOrder
      }
    });
  }

  toPaginatedOrderResponse(
    paginatedResult: Paginated<Order>
  ): PaginatedResponse<OrderResponseDto> {
    return {
      items: paginatedResult.items.map(order => this.toOrderResponseDto(order)),
      pagination: {
        page: paginatedResult.page,
        pageSize: paginatedResult.pageSize,
        total: paginatedResult.total,
        totalPages: paginatedResult.totalPages
      }
    };
  }

  private toOrderItemResponseDto(item: OrderItem): OrderItemResponseDto {
    return {
      productId: item.productId.value,
      productName: item.productName,
      unitPrice: item.unitPrice.amount,
      quantity: item.quantity,
      subtotal: item.subtotal.amount,
      imageUrl: item.imageUrl,
      specifications: item.specifications
    };
  }
}
```

## 🔒 安全与验证规范

### 4.1 自定义装饰器

```typescript
// 当前用户装饰器
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserDto => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  }
);

// 权限装饰器
export const Permissions = (...permissions: string[]) => 
  SetMetadata('permissions', permissions);

// 资源所有权装饰器
export const ResourceOwnership = (resourceType: string, idParam: string = 'id') => 
  applyDecorators(
    Param('id', ParseUUIDPipe),
    UseGuards(ResourceOwnershipGuard),
    SetMetadata('resourceType', resourceType),
    SetMetadata('idParam', idParam)
  );
```

### 4.2 守卫实现

```typescript
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler()
    );

    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('用户未认证');
    }

    const hasPermission = await this.permissionService.hasPermissions(
      user.id,
      requiredPermissions
    );

    if (!hasPermission) {
      throw new ForbiddenException('权限不足');
    }

    return true;
  }
}

@Injectable()
export class ResourceOwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly ownershipService: ResourceOwnershipService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resourceType = this.reflector.get<string>('resourceType', context.getHandler());
    const idParam = this.reflector.get<string>('idParam', context.getHandler());

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const resourceId = request.params[idParam];

    if (!user || !resourceId) {
      return false;
    }

    const isOwner = await this.ownershipService.isResourceOwner(
      user.id,
      resourceType,
      resourceId
    );

    if (!isOwner) {
      throw new ForbiddenException('无权访问该资源');
    }

    return true;
  }
}
```

### 4.3 异常过滤器

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status: number;
    let message: string;
    let code: string;
    let details: any;

    if (exception instanceof BaseException) {
      // 业务异常
      status = exception.httpStatus;
      message = exception.message;
      code = exception.code;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      // NestJS HTTP 异常
      status = exception.getStatus();
      message = exception.message;
      code = 'HTTP_ERROR';
    } else if (exception instanceof Error) {
      // 其他 JavaScript 错误
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '服务器内部错误';
      code = 'INTERNAL_SERVER_ERROR';
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    } else {
      // 未知错误
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '未知服务器错误';
      code = 'UNKNOWN_ERROR';
    }

    const errorResponse: ErrorResponseDto = {
      success: false,
      error: {
        code,
        message,
        details,
        path: request.url,
        timestamp: new Date().toISOString(),
        requestId: request.headers['x-request-id'] || ulid()
      }
    };

    // 记录错误日志
    this.logError(request, exception, errorResponse);

    response.status(status).json(errorResponse);
  }

  private logError(request: any, exception: unknown, errorResponse: ErrorResponseDto): void {
    const logEntry = {
      requestId: errorResponse.error.requestId,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      userId: request.user?.id,
      error: exception instanceof Error ? {
        name: exception.name,
        message: exception.message,
        stack: exception.stack
      } : exception,
      response: errorResponse
    };

    if (errorResponse.error.code === 'INTERNAL_SERVER_ERROR') {
      this.logger.error('Internal server error', logEntry);
    } else {
      this.logger.warn('Business exception', logEntry);
    }
  }
}
```

## 📊 可观测性规范

### 5.1 日志拦截器

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    const requestId = request.headers['x-request-id'] || ulid();
    const startTime = Date.now();

    // 设置请求ID
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    const logEntry = {
      requestId,
      method: request.method,
      url: request.url,
      query: request.query,
      body: this.sanitizeBody(request.body),
      userAgent: request.headers['user-agent'],
      userId: request.user?.id,
      ip: request.ip
    };

    this.logger.log('Incoming request', logEntry);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.log('Request completed', {
          requestId,
          statusCode: response.statusCode,
          duration: `${duration}ms`
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logger.error('Request failed', {
          requestId,
          error: error.message,
          duration: `${duration}ms`,
          statusCode: error.status || 500
        });
        return throwError(() => error);
      })
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;
    
    const sensitiveFields = ['password', 'token', 'authorization', 'creditCard'];
    const sanitized = { ...body };
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '***';
      }
    });
    
    return sanitized;
  }
}
```

### 5.2 监控指标

```typescript
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly requestDuration: Histogram;

  constructor(private readonly metricsService: MetricsService) {
    this.requestDuration = this.metricsService.createHistogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code']
    });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    const startTime = Date.now();
    const method = request.method;
    const route = request.route?.path || 'unknown';

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - startTime) / 1000;
        this.requestDuration
          .labels(method, route, response.statusCode.toString())
          .observe(duration);
      })
    );
  }
}
```

## 🔄 响应标准化

### 6.1 统一响应格式

```typescript
// 成功响应
export class ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: any;

  static success<T>(data: T, message?: string, meta?: any): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      meta
    };
  }

  static paginated<T>(
    items: T[],
    pagination: PaginationMeta,
    message?: string
  ): ApiResponse<PaginatedResponse<T>> {
    return {
      success: true,
      data: {
        items,
        pagination
      },
      message
    };
  }

  static empty(message: string = '操作成功'): ApiResponse<null> {
    return {
      success: true,
      data: null,
      message
    };
  }
}

// 错误响应
export class ErrorResponseDto {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: any;
    path: string;
    timestamp: string;
    requestId: string;
  };
}

// 分页响应
export class PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

## 🧪 测试规范

### 7.1 控制器测试

```typescript
describe('OrderController', () => {
  let controller: OrderController;
  let commandBus: CommandBus;
  let queryBus: QueryBus;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        {
          provide: CommandBus,
          useValue: { execute: jest.fn() }
        },
        {
          provide: QueryBus,
          useValue: { execute: jest.fn() }
        },
        {
          provide: OrderAssembler,
          useValue: {
            toCreateOrderCommand: jest.fn(),
            toOrderResponseDto: jest.fn()
          }
        }
      ]
    }).compile();

    controller = module.get<OrderController>(OrderController);
    commandBus = module.get<CommandBus>(CommandBus);
    queryBus = module.get<QueryBus>(QueryBus);
  });

  describe('createOrder', () => {
    it('应该成功创建订单并返回标准化响应', async () => {
      // Given
      const user = { id: 'user-123' };
      const createOrderDto = new CreateOrderRequestDto();
      const command = new CreateOrderCommand(/* ... */);
      const orderResult = new Order(/* ... */);
      const responseDto = new OrderResponseDto();

      jest.spyOn(controller['orderAssembler'], 'toCreateOrderCommand').mockReturnValue(command);
      jest.spyOn(commandBus, 'execute').mockResolvedValue(orderResult);
      jest.spyOn(controller['orderAssembler'], 'toOrderResponseDto').mockReturnValue(responseDto);

      // When
      const result = await controller.createOrder(user, createOrderDto);

      // Then
      expect(result.success).toBe(true);
      expect(result.data).toBe(responseDto);
      expect(commandBus.execute).toHaveBeenCalledWith(command);
    });

    it('应该处理验证错误', async () => {
      // Given
      const user = { id: 'user-123' };
      const invalidDto = new CreateOrderRequestDto();
      invalidDto.items = []; // 空订单项应该触发验证错误

      // When & Then
      await expect(controller.createOrder(user, invalidDto))
        .rejects
        .toThrow(BadRequestException);
    });
  });
});
```

## 📋 API 文档规范

### 8.1 Swagger 配置

```typescript
// main.ts
const config = new DocumentBuilder()
  .setTitle('订单管理系统 API')
  .setDescription('基于 DDD + Clean Architecture 的订单管理系统')
  .setVersion('1.0')
  .addBearerAuth(
    { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    'access-token'
  )
  .addTag('orders', '订单管理')
  .addTag('products', '商品管理')
  .addTag('customers', '客户管理')
  .addServer(process.env.API_BASE_URL || 'http://localhost:3000')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document, {
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true
  },
  customSiteTitle: '订单管理系统 API 文档'
});
```

## ✅ 总结

本规范确立了接口层设计的核心原则：

1. **薄控制器**: 控制器只负责协议适配和协调
2. **严格验证**: 所有输入必须经过多层验证
3. **统一响应**: 标准化的成功和错误响应格式
4. **安全保障**: 完善的认证、授权和资源权限控制
5. **可观测性**: 完整的日志、监控和追踪能力
6. **文档化**: 自动化的 API 文档生成

遵循本规范可以构建出安全、可靠、易用的接口层，为前端和第三方系统提供高质量的 API 服务。

---
*文档版本: 1.0 | 最后更新: 2024-11-XX | 适用项目: NestJS DDD 混合架构项目*