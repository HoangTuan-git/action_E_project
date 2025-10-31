const ProductService = require("../services/productsService");
const messageBroker = require("../utils/messageBroker");
class ProductController {
  constructor() {
    this.productService = new ProductService();
    this.createProduct = this.createProduct.bind(this);
    this.getProducts = this.getProducts.bind(this);
    this.createOrder = this.createOrder.bind(this);
    this.getProductById= this.getProductById.bind(this);
  }
  async getProductById(req, res){
    try {
      const id = req.params.id;
      const pd = await this.productService.getProductById(id);
      if(!pd.success){
        return res.status(404).json({message:pd.message});
      }
      return res.status(200).json(pd.product);
    } catch (error) {
      return res.status(500).json({message:"server error"});     
    }
  }
  async createProduct(req, res) {
    try {
      const product = req.body;
      
      // Input validation
      if (!product.name || !product.price) {
        return res.status(400).json({ 
          message: !product.name ? "Product name is required" : "Product price is required" 
        });
      }
      
      const result = await this.productService.createProduct(product);
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      res.status(201).json(result.createdProduct);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }

  async createOrder(req, res) {
    try {
      //lấy tất cả sản phẩm từ request body
      const products = req.body;
      if (!products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ message: "Invalid products data" });
      }
      //kiểm tra products có đủ id và quantity không
      for (const prod of products) {
        if (!prod._id || prod.quantity === undefined || prod.quantity === null) {
          return res.status(400).json({ message: "Each product must have an id and quantity" });
        }
        //check quantity > 0
        if(prod.quantity < 1){
          return res.status(400).json({message: "Product quantity must be > 0"})
        }
      }
      const username = req.user.username;
      //kiểm tra username có hợp lệ không
      if (!username) {
        return res.status(400).json({ message: "Invalid user data" });
      }
      //tạo order
      const result = await this.productService.createOrder(products, username);
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      // Trả về response
      res.status(201).json(result.order);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }


  async getProducts(req, res) {
    try {
      const products = await this.productService.getProducts();
      if (!products.success) {
        return res.status(404).json({ message: products.message });
      }
      res.status(200).json(products.products);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
 
}

module.exports = ProductController;
